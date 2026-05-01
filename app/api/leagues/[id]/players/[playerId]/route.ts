import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { upsertLeaguePlayer, removeLeaguePlayer } from '@/lib/db-leagues'
import { countMatches } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { deck_id } = await req.json()
  const { data, error } = upsertLeaguePlayer(params.id, params.playerId, { deck_id: deck_id ?? null })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; playerId: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: matchCount, error: countErr } = countMatches(params.id)
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (matchCount && matchCount > 0) {
    return NextResponse.json(
      { error: 'Les matchs ont déjà été générés. Impossible de désinscrire un joueur.' },
      { status: 400 }
    )
  }

  const { error } = removeLeaguePlayer(params.id, params.playerId)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
