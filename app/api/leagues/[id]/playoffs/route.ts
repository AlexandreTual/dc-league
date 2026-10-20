import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import {
  listPlayoffs, hasPlayoffs, generateSemifinals, deleteAllPlayoffs,
  countMatches, countCompletedMatches, STATUTS_LIGUE,
} from '@/lib/db'
import { loadStandings } from '@/lib/standings'
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

    const loaded = await loadStandings(db, id)
    if (loaded.error !== null) return resultError(loaded.error)
    const leaderboard = loaded.data.standings

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
