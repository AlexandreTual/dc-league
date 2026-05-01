import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { listPlayerDecks, insertDeck } from '@/lib/db-decks'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { data, error } = listPlayerDecks(params.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { name, commander_image_url, moxfield_url } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom du deck est requis' }, { status: 400 })
  }

  const { data, error } = insertDeck(params.id, {
    name: name.trim(),
    commander_image_url: commander_image_url?.trim() || null,
    moxfield_url: moxfield_url?.trim() || null,
  })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
