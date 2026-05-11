import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import { enrollLeaguePlayer } from '@/lib/db-leagues'
import { countMatches } from '@/lib/db'

export const runtime = 'edge'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const { data: matchCount, error: countErr } = await countMatches(db, params.id)
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (matchCount && matchCount > 0) {
    return NextResponse.json(
      { error: 'Les matchs ont déjà été générés. Impossible de modifier les participants.' },
      { status: 400 }
    )
  }

  const { player_id } = await req.json() as { player_id?: string }
  if (!player_id) return NextResponse.json({ error: 'player_id requis' }, { status: 400 })

  const { data, error } = await enrollLeaguePlayer(db, params.id, player_id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
