import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, requireUser } from '@/lib/auth/session'
import { canEditDeck } from '@/lib/auth/permissions'
import { deleteDeck, getDeck, updateDeck } from '@/lib/db-decks'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string }> }

async function loadEditableDeck(req: NextRequest, params: Params['params']) {
  const refused = assertSameOrigin(req)
  if (refused) return refused
  const user = await requireUser()
  if (user instanceof NextResponse) return user

  const { env } = getRequestContext<CloudflareEnv>()
  const { id } = await params
  const { data: deck, error } = await getDeck(env.DB, id)
  if (error !== null) return NextResponse.json({ error: 'Erreur interne, réessaie plus tard' }, { status: 500 })
  if (!deck) return NextResponse.json({ error: 'Deck introuvable' }, { status: 404 })
  if (!canEditDeck(user, deck)) {
    return NextResponse.json({ error: 'Tu ne peux gérer que tes propres decks' }, { status: 403 })
  }
  return { db: env.DB, deck }
}

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
  if (error !== null) return NextResponse.json({ error: 'Erreur interne, réessaie plus tard' }, { status: 500 })
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
  if (error !== null) return NextResponse.json({ error: 'Erreur interne, réessaie plus tard' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
