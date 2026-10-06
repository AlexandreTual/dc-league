import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { generateRoundRobinMatches } from '@/lib/leaderboard'
import { countMatches, insertMatches, deleteAllMatches, deleteAllPlayoffs, STATUTS_LIGUE } from '@/lib/db'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'

export const runtime = 'edge'

export function POST(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { data: league, error: leagueErr } = await getActiveLeague(db)
    if (leagueErr !== null) return resultError(leagueErr)
    if (!league) return badRequest('Aucune ligue active.')

    const { data: existing, error: countErr } = await countMatches(db, league.id)
    if (countErr !== null) return resultError(countErr)
    if (existing > 0) return NextResponse.json({ error: 'Les matchs ont déjà été générés.' }, { status: 409 })

    const { data: enrolled, error: enrolledErr } = await listLeaguePlayers(db, league.id)
    if (enrolledErr !== null) return resultError(enrolledErr)
    if (enrolled.length < 2) return badRequest('Il faut au moins 2 joueurs inscrits pour générer la ligue.')

    const matchDefs = generateRoundRobinMatches(enrolled.map((p) => p.player_id))
    const { data, error } = await insertMatches(db, matchDefs, league.id)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json({ ok: true, count: data.length, matches: data }, { status: 201 })
  })
}

export function DELETE(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { data: league, error: leagueErr } = await getActiveLeague(db)
    if (leagueErr !== null) return resultError(leagueErr)
    if (!league) return badRequest('Aucune ligue active.')

    const { error } = await deleteAllMatches(db, league.id)
    if (error !== null) return resultError(error)
    const { error: pErr } = await deleteAllPlayoffs(db, league.id)
    if (pErr !== null) return resultError(pErr)
    return NextResponse.json({ ok: true })
  })
}
