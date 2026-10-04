import { NextRequest, NextResponse } from 'next/server'
import { chooseDeck } from '@/lib/db-games'
import { gameWrite, resultResponse } from '@/lib/games/http'

export const runtime = 'edge'

/** Choisit son deck pour la partie. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return gameWrite(req, async ({ db, user, body }) => {
    if (typeof body.deckId !== 'string') return NextResponse.json({ error: 'Deck manquant' }, { status: 400 })
    return resultResponse(await chooseDeck(db, id, user.playerId, body.deckId))
  })
}
