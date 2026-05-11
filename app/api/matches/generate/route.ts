import { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import { generateRoundRobinMatches } from '@/lib/leaderboard'
import { countMatches, insertMatches, deleteAllMatches, deleteAllPlayoffs } from '@/lib/db'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'

export const runtime = 'edge'

export async function POST() {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const { data: league } = await getActiveLeague(db)
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })

  const { data: existing, error: countErr } = await countMatches(db, league.id)
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (existing && existing > 0) {
    return NextResponse.json({ error: 'Les matchs ont déjà été générés.' }, { status: 400 })
  }

  const { data: enrolled, error: enrolledErr } = await listLeaguePlayers(db, league.id)
  if (enrolledErr) return NextResponse.json({ error: enrolledErr }, { status: 500 })
  if (!enrolled || enrolled.length < 2) {
    return NextResponse.json(
      { error: 'Il faut au moins 2 joueurs inscrits pour générer la ligue.' },
      { status: 400 }
    )
  }

  const matchDefs = generateRoundRobinMatches(enrolled.map((p) => p.player_id))
  const { data, error } = await insertMatches(db, matchDefs, league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true, count: data?.length ?? 0, matches: data }, { status: 201 })
}

export async function DELETE() {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const { data: league } = await getActiveLeague(db)
  if (!league) return NextResponse.json({ error: 'Aucune ligue active.' }, { status: 400 })

  const { error } = await deleteAllMatches(db, league.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  const { error: pErr } = await deleteAllPlayoffs(db, league.id)
  if (pErr) return NextResponse.json({ error: pErr }, { status: 500 })
  return NextResponse.json({ ok: true })
}
