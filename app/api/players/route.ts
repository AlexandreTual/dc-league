import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { listPlayers, insertPlayer, deletePlayer, countMatches } from '@/lib/db'
import { getActiveLeague, enrollLeaguePlayer } from '@/lib/db-leagues'

export async function GET() {
  const { data, error } = listPlayers()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  const { data: player, error: playerErr } = insertPlayer({ name: name.trim() })
  if (playerErr) return NextResponse.json({ error: playerErr }, { status: 500 })

  const { data: league } = getActiveLeague()
  if (league) {
    const { data: count } = countMatches(league.id)
    if (!count || count === 0) {
      enrollLeaguePlayer(league.id, player!.id)
    }
  }

  return NextResponse.json(player!, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const { error } = deletePlayer(id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
