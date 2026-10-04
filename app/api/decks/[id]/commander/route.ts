import { NextRequest, NextResponse } from 'next/server'
import { INTERNAL_ERROR, loadEditableDeck } from '@/lib/cards/deck-access'
import { setCommander, setDeckCommanderImage } from '@/lib/db-cards'

export const runtime = 'edge'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await loadEditableDeck(req, params)
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { position?: unknown }
  if (!Number.isInteger(body.position)) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })

  const { data: card, error } = await setCommander(ctx.db, ctx.deck.id, body.position as number)
  if (error === 'NOT_FOUND') return NextResponse.json({ error: 'Carte introuvable dans ce deck' }, { status: 404 })
  if (error === 'NOT_LEGENDARY') {
    return NextResponse.json({ error: 'Seule une carte légendaire peut être commandant' }, { status: 400 })
  }
  if (error !== null) return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 })

  if (card.image_normal) await setDeckCommanderImage(ctx.db, ctx.deck.id, card.image_normal)
  return NextResponse.json({ ok: true })
}
