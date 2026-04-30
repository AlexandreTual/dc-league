import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import {
  listPlayoffs, hasPlayoffs, generateSemifinals, deleteAllPlayoffs,
  countMatches, countCompletedMatches, listPlayers, listCompletedMatches,
} from '@/lib/db'
import { computeLeaderboard, Player, Match } from '@/lib/leaderboard'
import { getActiveLeague } from '@/lib/db-leagues'

export async function GET() {
  const { data: league } = getActiveLeague()
  if (!league) return NextResponse.json([])
  const { data, error } = listPlayoffs(league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { data: league } = getActiveLeague()
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })

  const { data: total } = countMatches(league.id)
  const { data: completed } = countCompletedMatches(league.id)
  if (!total || total === 0) {
    return NextResponse.json({ error: 'Aucun match de ligue généré.' }, { status: 400 })
  }
  if (total !== completed) {
    return NextResponse.json(
      { error: `Il reste ${(total ?? 0) - (completed ?? 0)} match(s) de ligue à jouer.` },
      { status: 400 }
    )
  }
  const { data: already } = hasPlayoffs(league.id)
  if (already) {
    return NextResponse.json({ error: 'Les playoffs ont déjà été générés.' }, { status: 400 })
  }

  const { data: players } = listPlayers()
  const { data: matches } = listCompletedMatches(league.id)
  const leaderboard = computeLeaderboard(
    (players ?? []) as Player[],
    (matches ?? []) as Match[]
  )
  if (leaderboard.length < 4) {
    return NextResponse.json(
      { error: 'Il faut au moins 4 joueurs pour générer les playoffs.' },
      { status: 400 }
    )
  }

  const [rank1, rank2, rank3, rank4] = leaderboard
  const { data, error } = generateSemifinals(league.id, rank1.id, rank2.id, rank3.id, rank4.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { data: league } = getActiveLeague()
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })
  const { error } = deleteAllPlayoffs(league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
