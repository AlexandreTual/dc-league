import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { requiredId } from '@/lib/auth/validation'
import { enrollLeaguePlayer } from '@/lib/db-leagues'
import { countMatches, STATUTS_LIGUE } from '@/lib/db'
import { leagueFor } from '@/lib/leagues/route-access'
import { LEAGUE_FINISHED } from '@/lib/leagues/join'

export const runtime = 'edge'

/** L'organisateur (ou un admin) inscrit un joueur, avant la génération des matchs. */
export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'user', async ({ db, body, user }) => {
    const { id } = await params
    const access = await leagueFor(db, id, user, 'manage')
    if (access instanceof NextResponse) return access
    if (!access.league.is_active) return badRequest(LEAGUE_FINISHED)

    const { data: matchCount, error: countErr } = await countMatches(db, id)
    if (countErr !== null) return resultError(countErr)
    if (matchCount > 0) {
      return badRequest('Les matchs ont déjà été générés. Impossible de modifier les participants.')
    }

    const playerId = requiredId(body.player_id, 'Le joueur')
    if (!playerId.ok) return badRequest(playerId.error)

    const { data, error } = await enrollLeaguePlayer(db, id, playerId.value)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json(data, { status: 201 })
  })
}
