import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import {
  listPlayers,
  insertPlayer,
  deletePlayer,
  countMatches,
} from '@/lib/db'

export async function GET() {
  const { data, error } = listPlayers()
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await req.json()
  const { name, moxfield_url } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
  }

  const { data: count, error: countErr } = countMatches()
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (count && count > 0) {
    return NextResponse.json(
      { error: "La ligue a déjà été générée. Impossible d'ajouter un joueur." },
      { status: 400 }
    )
  }

  const { data, error } = insertPlayer({ name: name.trim(), moxfield_url: moxfield_url?.trim() || null })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 })

  const { data: count, error: countErr } = countMatches()
  if (countErr) return NextResponse.json({ error: countErr }, { status: 500 })
  if (count && count > 0) {
    return NextResponse.json(
      { error: 'La ligue a déjà été générée. Impossible de supprimer un joueur.' },
      { status: 400 }
    )
  }

  const { error } = deletePlayer(id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
