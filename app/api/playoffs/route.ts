import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import {
  listPlayoffs,
  hasPlayoffs,
  generateSemifinals,
  deleteAllPlayoffs,
  countMatches,
  countCompletedMatches,
  listPlayers,
} from '@/lib/db'
import { computeLeaderboard, Player, Match } from '@/lib/leaderboard'
import { listCompletedMatches } from '@/lib/db'

export async function GET() {
  const { data, error } = listPlayoffs()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Vérifier que tous les matchs RR sont joués
  const { data: total } = countMatches()
  const { data: completed } = countCompletedMatches()

  if (!total || total === 0) {
    return NextResponse.json({ error: 'Aucun match de ligue généré.' }, { status: 400 })
  }
  if (total !== completed) {
    return NextResponse.json(
      { error: `Il reste ${(total ?? 0) - (completed ?? 0)} match(s) de ligue à jouer.` },
      { status: 400 }
    )
  }

  // Vérifier que les playoffs n'existent pas encore
  const { data: already } = hasPlayoffs()
  if (already) {
    return NextResponse.json({ error: 'Les playoffs ont déjà été générés.' }, { status: 400 })
  }

  // Calculer le leaderboard pour obtenir le Top 4
  const { data: players } = listPlayers()
  const { data: matches } = listCompletedMatches()

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
  const { data, error } = generateSemifinals(rank1.id, rank2.id, rank3.id, rank4.id)
  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { error } = deleteAllPlayoffs()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
