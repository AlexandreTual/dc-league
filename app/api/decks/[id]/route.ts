import { NextRequest, NextResponse } from 'next/server'
import { deleteDeck, updateDeck } from '@/lib/db-decks'
import { INTERNAL_ERROR, loadEditableDeck } from '@/lib/cards/deck-access'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string }> }

const emptyToNull = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null)

export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await loadEditableDeck(req, params)
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    moxfield_url?: string | null
    commander_image_url?: string | null
  }
  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ error: 'Le nom du deck est requis' }, { status: 400 })
  }
  const { data, error } = await updateDeck(ctx.db, ctx.deck.id, {
    name: body.name?.trim(),
    moxfield_url: emptyToNull(body.moxfield_url),
    commander_image_url: emptyToNull(body.commander_image_url),
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
