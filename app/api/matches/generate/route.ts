import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { generateRoundRobinMatches } from '@/lib/leaderboard'
import { countMatches, insertMatches, deleteAllMatches, deleteAllPlayoffs } from '@/lib/db'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'

export async function POST() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { data: league } = getActiveLeague()
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })

  const { data: existing, error: countErr } = countMatches(league.id)
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (existing && existing > 0) {
    return NextResponse.json({ error: 'Les matchs ont déjà été générés.' }, { status: 400 })
  }

  const { data: enrolled, error: enrolledErr } = listLeaguePlayers(league.id)
  if (enrolledErr) return NextResponse.json({ error: enrolledErr }, { status: 500 })
  if (!enrolled || enrolled.length < 2) {
    return NextResponse.json(
      { error: 'Il faut au moins 2 joueurs inscrits pour générer la ligue.' },
      { status: 400 }
    )
  }

  const matchDefs = generateRoundRobinMatches(enrolled.map((p) => p.player_id))
  const { data, error } = insertMatches(matchDefs, league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true, count: data?.length ?? 0 }, { status: 201 })
}

export async function DELETE() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { data: league } = getActiveLeague()
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })

  const { error } = deleteAllMatches(league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  const { error: pErr } = deleteAllPlayoffs(league.id)
  if (pErr) return NextResponse.json({ error: pErr }, { status: 500 })
  return NextResponse.json({ ok: true })
}
