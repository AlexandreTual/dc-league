import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest } from '@/lib/auth/api'
import { editableDeck } from '@/lib/cards/deck-access'
import { validateBatch } from '@/lib/cards/parse'
import { resolveLines } from '@/lib/cards/resolve'
import { createScryfallClient, ScryfallUnavailableError } from '@/lib/cards/scryfall'

export const runtime = 'edge'

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'user', editableDeck(params, async ({ db, body }) => {
    const lines = validateBatch(body.lines)
    if (!lines) return badRequest('Paquet invalide')

    const client = createScryfallClient({ fetch, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) })
    try {
      return NextResponse.json(await resolveLines(db, client, lines, new Date()))
    } catch (e) {
      if (e instanceof ScryfallUnavailableError) {
        return NextResponse.json({ error: 'Scryfall ne répond pas, réessaie dans un instant' }, { status: 503 })
      }
      // Toute autre exception : 500 en français, notée dans le journal des erreurs par apiRoute.
      throw e
    }
  }))
}
