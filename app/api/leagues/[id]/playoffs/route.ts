import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import {
  listPlayoffs, hasPlayoffs, generateSemifinals, deleteAllPlayoffs,
  countMatches, countCompletedMatches, listPlayers, listCompletedMatches, STATUTS_LIGUE,
} from '@/lib/db'
import { computeLeaderboard, Player, Match } from '@/lib/leaderboard'
import { listLeaguePlayers } from '@/lib/db-leagues'
import { leagueFor } from '@/lib/leagues/route-access'
import { LEAGUE_FINISHED } from '@/lib/leagues/join'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string }> }

export function GET(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'viewer', async ({ db, user }) => {
    const { id } = await params
    const access = await leagueFor(db, id, user, 'view')
    if (access instanceof NextResponse) return access
    const { data, error } = await listPlayoffs(db, id)
    if (error !== null) return resultError(error)
    return NextResponse.json(data)
  })
}

/** Demi-finales entre les 4 premiers, une fois le round-robin terminé. */
export function POST(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, user }) => {
    const { id } = await params
    const access = await leagueFor(db, id, user, 'manage')
    if (access instanceof NextResponse) return access
    if (!access.league.is_active) return badRequest(LEAGUE_FINISHED)

    const total = await countMatches(db, id)
    if (total.error !== null) return resultError(total.error)
    const completed = await countCompletedMatches(db, id)
    if (completed.error !== null) return resultError(completed.error)
    if (total.data === 0) return badRequest('Aucun match de ligue généré.')
    if (total.data !== completed.data) {
      return badRequest(`Il reste ${total.data - completed.data} match(s) de ligue à jouer.`)
    }

    const already = await hasPlayoffs(db, id)
    if (already.error !== null) return resultError(already.error)
    if (already.data) return NextResponse.json({ error: 'Les playoffs ont déjà été générés.' }, { status: 409 })

    const [leaguePlayers, allPlayers, matches] = await Promise.all([
      listLeaguePlayers(db, id),
      listPlayers(db),
      listCompletedMatches(db, id),
    ])
    if (leaguePlayers.error !== null) return resultError(leaguePlayers.error)
    if (allPlayers.error !== null) return resultError(allPlayers.error)
    if (matches.error !== null) return resultError(matches.error)

    const enrolledIds = new Set(leaguePlayers.data.map((lp) => lp.player_id))
    const enrolledPlayers = allPlayers.data.filter((p) => enrolledIds.has(p.id))
    const leaderboard = computeLeaderboard(enrolledPlayers as Player[], matches.data as Match[], id)

    if (leaderboard.length < 4) {
      return badRequest(`Il faut au moins 4 joueurs inscrits pour générer les playoffs (${leaderboard.length} inscrits).`)
    }

    const [rank1, rank2, rank3, rank4] = leaderboard
    const { data, error } = await generateSemifinals(db, id, rank1.id, rank2.id, rank3.id, rank4.id)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json(data, { status: 201 })
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, user }) => {
    const { id } = await params
    const access = await leagueFor(db, id, user, 'manage')
    if (access instanceof NextResponse) return access
    if (!access.league.is_active) return badRequest(LEAGUE_FINISHED)
    const { error } = await deleteAllPlayoffs(db, id)
    if (error !== null) return resultError(error)
    return NextResponse.json({ ok: true })
  })
}
