import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { generateRoundRobinMatches } from '@/lib/leaderboard'
import { countMatches, insertMatches, resetLeague, STATUTS_LIGUE } from '@/lib/db'
import { listLeaguePlayers } from '@/lib/db-leagues'
import { leagueFor } from '@/lib/leagues/route-access'
import { LEAGUE_FINISHED } from '@/lib/leagues/join'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string }> }

/** Génère le round-robin de la ligue. */
export function POST(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, user }) => {
    const { id } = await params
    const access = await leagueFor(db, id, user, 'manage')
    if (access instanceof NextResponse) return access
    if (!access.league.is_active) return badRequest(LEAGUE_FINISHED)

    const { data: existing, error: countErr } = await countMatches(db, id)
    if (countErr !== null) return resultError(countErr)
    if (existing > 0) return NextResponse.json({ error: 'Les matchs ont déjà été générés.' }, { status: 409 })

    const { data: enrolled, error: enrolledErr } = await listLeaguePlayers(db, id)
    if (enrolledErr !== null) return resultError(enrolledErr)
    if (enrolled.length < 2) return badRequest('Il faut au moins 2 joueurs inscrits pour générer la ligue.')

    const matchDefs = generateRoundRobinMatches(enrolled.map((p) => p.player_id))
    const { data, error } = await insertMatches(db, matchDefs, id, enrolled.length)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json({ ok: true, count: data.length, matches: data }, { status: 201 })
  })
}

/** Réinitialise le round-robin et les playoffs de la ligue. */
export function DELETE(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, user }) => {
    const { id } = await params
    const access = await leagueFor(db, id, user, 'manage')
    if (access instanceof NextResponse) return access
    if (!access.league.is_active) return badRequest(LEAGUE_FINISHED)

    const { error } = await resetLeague(db, id)
    if (error !== null) return resultError(error)
    return NextResponse.json({ ok: true })
  })
}
