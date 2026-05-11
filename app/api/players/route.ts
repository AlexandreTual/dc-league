import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import { listPlayers, insertPlayer, deletePlayer, countMatches } from '@/lib/db'
import { getActiveLeague, enrollLeaguePlayer } from '@/lib/db-leagues'

export const runtime = 'edge'

export async function GET() {
  const { env } = getRequestContext<CloudflareEnv>()
  const { data, error } = await listPlayers(env.DB)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { name } = await req.json() as { name?: string }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const { data: player, error: playerErr } = await insertPlayer(db, { name: name.trim() })
  if (playerErr) return NextResponse.json({ error: playerErr }, { status: 500 })

  const { data: league } = await getActiveLeague(db)
  if (league) {
    const { data: count } = await countMatches(db, league.id)
    if (!count || count === 0) {
      await enrollLeaguePlayer(db, league.id, player!.id)
    }
  }

  return NextResponse.json(player!, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await req.json() as { id?: string }
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const { env } = getRequestContext<CloudflareEnv>()
  const { error } = await deletePlayer(env.DB, id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
