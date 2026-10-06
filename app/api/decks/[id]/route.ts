import { NextRequest, NextResponse } from 'next/server'
import { deleteDeck, updateDeck } from '@/lib/db-decks'
import { INTERNAL_ERROR, loadEditableDeck } from '@/lib/cards/deck-access'
import { MAX_LENGTH, optionalCardImage, optionalDeckLink, optionalText } from '@/lib/auth/validation'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await loadEditableDeck(req, params)
  if (ctx instanceof NextResponse) return ctx

  const parsed: unknown = await req.json().catch(() => ({}))
  const body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  const name = optionalText(body.name, 'Le nom du deck', MAX_LENGTH.deckName)
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 })
  const link = optionalDeckLink(body.moxfield_url)
  if (!link.ok) return NextResponse.json({ error: link.error }, { status: 400 })
  const image = optionalCardImage(body.commander_image_url)
  if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 })

  const { data, error } = await updateDeck(ctx.db, ctx.deck.id, {
    name: name.value,
    moxfield_url: link.value,
    commander_image_url: image.value,
  })
  if (error !== null) return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await loadEditableDeck(req, params)
  if (ctx instanceof NextResponse) return ctx

  const { error } = await deleteDeck(ctx.db, ctx.deck.id)
  if (error === 'DECK_IN_USE') {
    return NextResponse.json(
      { error: 'Ce deck a été utilisé dans une ligue : renomme-le plutôt que de le supprimer' },
      { status: 409 },
    )
  }
  if (error !== null) return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 })
  return NextResponse.json({ ok: true })
}
