import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { upsertLeaguePlayer, removeLeaguePlayer } from '@/lib/db-leagues'
import { countMatches } from '@/lib/db'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string; playerId: string }> }

export function PATCH(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'admin', async ({ db, body }) => {
    const { id, playerId } = await params
    const deckId = body.deck_id ?? null
    if (deckId !== null && (typeof deckId !== 'string' || deckId.length > 100)) return badRequest('Deck invalide')
    const { data, error } = await upsertLeaguePlayer(db, id, playerId, { deck_id: deckId || null })
    if (error !== null) return resultError(error)
    return NextResponse.json(data)
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { id, playerId } = await params

    const { data: matchCount, error: countErr } = await countMatches(db, id)
    if (countErr !== null) return resultError(countErr)
    if (matchCount > 0) {
      return badRequest('Les matchs ont déjà été générés. Impossible de désinscrire un joueur.')
    }

    const { error } = await removeLeaguePlayer(db, id, playerId)
    if (error !== null) return resultError(error)
    return NextResponse.json({ ok: true })
  })
}
