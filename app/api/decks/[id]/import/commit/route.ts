import { NextRequest, NextResponse } from 'next/server'
import { INTERNAL_ERROR, loadEditableDeck } from '@/lib/cards/deck-access'
import { commitDeckList } from '@/lib/cards/commit'

export const runtime = 'edge'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await loadEditableDeck(req, params)
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { text?: unknown }
  const text = typeof body.text === 'string' ? body.text : ''
  const { data, error } = await commitDeckList(ctx.db, ctx.deck.id, text)
  if (error === 'EMPTY') return NextResponse.json({ error: 'La liste est vide' }, { status: 400 })
  if (error === 'TOO_LONG') return NextResponse.json({ error: 'La liste dépasse 250 lignes' }, { status: 400 })
  if (error !== null) return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 })
  return NextResponse.json(data)
}
