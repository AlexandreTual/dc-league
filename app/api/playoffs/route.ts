import { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import {
  listPlayoffs, hasPlayoffs, generateSemifinals, deleteAllPlayoffs,
  countMatches, countCompletedMatches, listPlayers, listCompletedMatches,
} from '@/lib/db'
import { computeLeaderboard, Player, Match } from '@/lib/leaderboard'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'

export const runtime = 'edge'

export async function GET() {
  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB
  const { data: league } = await getActiveLeague(db)
  if (!league) return NextResponse.json([])
  const { data, error } = await listPlayoffs(db, league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST() {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const { data: league } = await getActiveLeague(db)
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })

  const { data: total } = await countMatches(db, league.id)
  const { data: completed } = await countCompletedMatches(db, league.id)
  if (!total || total === 0) {
    return NextResponse.json({ error: 'Aucun match de ligue généré.' }, { status: 400 })
  }
  if (total !== completed) {
    return NextResponse.json(
      { error: `Il reste ${(total ?? 0) - (completed ?? 0)} match(s) de ligue à jouer.` },
      { status: 400 }
    )
  }

  const { data: already } = await hasPlayoffs(db, league.id)
  if (already) {
    return NextResponse.json({ error: 'Les playoffs ont déjà été générés.' }, { status: 400 })
  }

  const [{ data: leaguePlayers }, { data: allPlayers }, { data: matches }] = await Promise.all([
    listLeaguePlayers(db, league.id),
    listPlayers(db),
    listCompletedMatches(db, league.id),
  ])

  const enrolledIds = new Set((leaguePlayers ?? []).map((lp) => lp.player_id))
  const enrolledPlayers = (allPlayers ?? []).filter((p) => enrolledIds.has(p.id))
  const leaderboard = computeLeaderboard(enrolledPlayers as Player[], (matches ?? []) as Match[])

  if (leaderboard.length < 4) {
    return NextResponse.json(
      { error: `Il faut au moins 4 joueurs inscrits pour générer les playoffs (${leaderboard.length} inscrits).` },
      { status: 400 }
    )
  }

  const [rank1, rank2, rank3, rank4] = leaderboard
  const { data, error } = await generateSemifinals(db, league.id, rank1.id, rank2.id, rank3.id, rank4.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE() {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const { data: league } = await getActiveLeague(db)
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })
  const { error } = await deleteAllPlayoffs(db, league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
