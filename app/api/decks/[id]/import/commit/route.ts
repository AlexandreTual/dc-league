import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, dbFailure } from '@/lib/auth/api'
import { editableDeck } from '@/lib/cards/deck-access'
import { commitDeckList } from '@/lib/cards/commit'
import { createScryfallClient } from '@/lib/cards/scryfall'
import { getLang } from '@/lib/i18n/server'

export const runtime = 'edge'

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'user', editableDeck(params, async ({ db, deck, body }) => {
    const text = typeof body.text === 'string' ? body.text : ''
    const client = createScryfallClient({ fetch, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) })
    const { data, error } = await commitDeckList(db, deck.id, text, client, await getLang())
    if (error === 'EMPTY') return badRequest('La liste est vide')
    if (error === 'TOO_LONG') return badRequest('La liste dépasse 250 lignes')
    if (error !== null) return dbFailure(error)
    return NextResponse.json(data)
  }))
}
