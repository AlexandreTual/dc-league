import { NextRequest, NextResponse } from 'next/server'
import { INTERNAL_ERROR, loadEditableDeck } from '@/lib/cards/deck-access'
import { createScryfallClient, ScryfallUnavailableError } from '@/lib/cards/scryfall'
import { refreshDeckTokens, TOKENS_NOT_READY } from '@/lib/cards/tokens'

export const runtime = 'edge'

/** « Mettre à jour les jetons » : recalcule les jetons du deck depuis ses cartes déjà importées. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await loadEditableDeck(req, params)
  if (ctx instanceof NextResponse) return ctx

  const client = createScryfallClient({ fetch, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) })
  try {
    const { data, error } = await refreshDeckTokens(ctx.db, client, ctx.deck.id)
    if (error !== null) {
      if (error.includes('no such table')) return NextResponse.json({ error: TOKENS_NOT_READY }, { status: 503 })
      console.error('[jetons]', error)
      return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 })
    }
    return NextResponse.json({ count: data.length })
  } catch (e) {
    if (e instanceof ScryfallUnavailableError) {
      return NextResponse.json({ error: 'Scryfall ne répond pas, réessaie dans un instant' }, { status: 503 })
    }
    console.error('[jetons]', e)
    return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 })
  }
}
