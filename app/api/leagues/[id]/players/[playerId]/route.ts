import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import { upsertLeaguePlayer, removeLeaguePlayer } from '@/lib/db-leagues'
import { countMatches } from '@/lib/db'

export const runtime = 'edge'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const { id, playerId } = await params
  const { deck_id } = await req.json() as { deck_id?: string | null }
  const { data, error } = await upsertLeaguePlayer(env.DB, id, playerId, { deck_id: deck_id ?? null })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB
  const { id, playerId } = await params

  const { data: matchCount, error: countErr } = await countMatches(db, id)
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (matchCount && matchCount > 0) {
    return NextResponse.json(
      { error: 'Les matchs ont déjà été générés. Impossible de désinscrire un joueur.' },
      { status: 400 }
    )
  }

  const { error } = await removeLeaguePlayer(db, id, playerId)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
