import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import {
  listPlayoffs, hasPlayoffs, generateSemifinals, deleteAllPlayoffs,
  countMatches, countCompletedMatches, listPlayers, listCompletedMatches, STATUTS_LIGUE,
} from '@/lib/db'
import { computeLeaderboard, Player, Match } from '@/lib/leaderboard'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'

export const runtime = 'edge'

export function GET(req: NextRequest) {
  return apiRoute(req, 'public', async ({ db }) => {
    const { data: league, error: leagueErr } = await getActiveLeague(db)
    if (leagueErr !== null) return resultError(leagueErr)
    if (!league) return NextResponse.json([])
    const { data, error } = await listPlayoffs(db, league.id)
    if (error !== null) return resultError(error)
    return NextResponse.json(data)
  })
}

export function POST(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { data: league, error: leagueErr } = await getActiveLeague(db)
    if (leagueErr !== null) return resultError(leagueErr)
    if (!league) return badRequest('Aucune ligue active.')

    const total = await countMatches(db, league.id)
    if (total.error !== null) return resultError(total.error)
    const completed = await countCompletedMatches(db, league.id)
    if (completed.error !== null) return resultError(completed.error)
    if (total.data === 0) return badRequest('Aucun match de ligue généré.')
    if (total.data !== completed.data) {
      return badRequest(`Il reste ${total.data - completed.data} match(s) de ligue à jouer.`)
    }

    const already = await hasPlayoffs(db, league.id)
    if (already.error !== null) return resultError(already.error)
    if (already.data) return NextResponse.json({ error: 'Les playoffs ont déjà été générés.' }, { status: 409 })

    const [leaguePlayers, allPlayers, matches] = await Promise.all([
      listLeaguePlayers(db, league.id),
      listPlayers(db),
      listCompletedMatches(db, league.id),
    ])
    if (leaguePlayers.error !== null) return resultError(leaguePlayers.error)
    if (allPlayers.error !== null) return resultError(allPlayers.error)
    if (matches.error !== null) return resultError(matches.error)

    const enrolledIds = new Set(leaguePlayers.data.map((lp) => lp.player_id))
    const enrolledPlayers = allPlayers.data.filter((p) => enrolledIds.has(p.id))
    const leaderboard = computeLeaderboard(enrolledPlayers as Player[], matches.data as Match[])

    if (leaderboard.length < 4) {
      return badRequest(`Il faut au moins 4 joueurs inscrits pour générer les playoffs (${leaderboard.length} inscrits).`)
    }

    const [rank1, rank2, rank3, rank4] = leaderboard
    const { data, error } = await generateSemifinals(db, league.id, rank1.id, rank2.id, rank3.id, rank4.id)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json(data, { status: 201 })
  })
}

export function DELETE(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { data: league, error: leagueErr } = await getActiveLeague(db)
    if (leagueErr !== null) return resultError(leagueErr)
    if (!league) return badRequest('Aucune ligue active.')
    const { error } = await deleteAllPlayoffs(db, league.id)
    if (error !== null) return resultError(error)
    return NextResponse.json({ ok: true })
  })
}
