import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, dbFailure } from '@/lib/auth/api'
import { editableDeck } from '@/lib/cards/deck-access'
import { createScryfallClient, ScryfallUnavailableError } from '@/lib/cards/scryfall'
import { refreshDeckTokens, TOKENS_NOT_READY } from '@/lib/cards/tokens'

export const runtime = 'edge'

/** « Mettre à jour les jetons » : recalcule les jetons du deck depuis ses cartes déjà importées. */
export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'user', editableDeck(params, async ({ db, deck }) => {
    const client = createScryfallClient({ fetch, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) })
    try {
      const { data, error } = await refreshDeckTokens(db, client, deck.id)
      if (error !== null) {
        if (error.includes('no such table')) return NextResponse.json({ error: TOKENS_NOT_READY }, { status: 503 })
        return dbFailure(error)
      }
      return NextResponse.json({ count: data.length })
    } catch (e) {
      if (e instanceof ScryfallUnavailableError) {
        return NextResponse.json({ error: 'Scryfall ne répond pas, réessaie dans un instant' }, { status: 503 })
      }
      // Toute autre exception : 500 en français, notée dans le journal des erreurs par apiRoute.
      throw e
    }
  }))
}
