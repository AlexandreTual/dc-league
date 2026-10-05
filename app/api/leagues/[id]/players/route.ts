import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { requiredId } from '@/lib/auth/validation'
import { enrollLeaguePlayer } from '@/lib/db-leagues'
import { countMatches } from '@/lib/db'

export const runtime = 'edge'

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'admin', async ({ db, body }) => {
    const { id } = await params

    const { data: matchCount, error: countErr } = await countMatches(db, id)
    if (countErr !== null) return resultError(countErr)
    if (matchCount > 0) {
      return badRequest('Les matchs ont déjà été générés. Impossible de modifier les participants.')
    }

    const playerId = requiredId(body.player_id, 'Le joueur')
    if (!playerId.ok) return badRequest(playerId.error)

    const { data, error } = await enrollLeaguePlayer(db, id, playerId.value)
    if (error !== null) return resultError(error)
    return NextResponse.json(data, { status: 201 })
  })
}
