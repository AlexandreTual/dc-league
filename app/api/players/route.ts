import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { listPlayers, insertPlayer, deletePlayer, countMatches } from '@/lib/db'
import { getActiveLeague, upsertLeaguePlayer } from '@/lib/db-leagues'

export async function GET() {
  const { data, error } = listPlayers()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: league, error: leagueErr } = getActiveLeague()
  if (leagueErr) return NextResponse.json({ error: leagueErr }, { status: 500 })
  if (!league) {
    return NextResponse.json(
      { error: "Aucune ligue active. Créez une saison d'abord." },
      { status: 400 }
    )
  }

  const { name, moxfield_url, commander_image_url } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  const { data: count, error: countErr } = countMatches(league.id)
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (count && count > 0) {
    return NextResponse.json(
      { error: "La ligue a déjà été générée. Impossible d'ajouter un joueur." },
      { status: 400 }
    )
  }

  const { data: player, error: playerErr } = insertPlayer({ name: name.trim() })
  if (playerErr) return NextResponse.json({ error: playerErr }, { status: 500 })

  const { error: lpErr } = upsertLeaguePlayer(league.id, player!.id, {
    moxfield_url: moxfield_url?.trim() || null,
    commander_image_url: commander_image_url?.trim() || null,
  })
  if (lpErr) return NextResponse.json({ error: lpErr }, { status: 500 })

  return NextResponse.json(
    {
      ...player,
      moxfield_url: moxfield_url?.trim() || null,
      commander_image_url: commander_image_url?.trim() || null,
    },
    { status: 201 }
  )
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data: league } = getActiveLeague()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  if (league) {
    const { data: count, error: countErr } = countMatches(league.id)
    if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
    if (count && count > 0) {
      return NextResponse.json(
        { error: 'La ligue a déjà été générée. Impossible de supprimer un joueur.' },
        { status: 400 }
      )
    }
  }

  const { error } = deletePlayer(id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
