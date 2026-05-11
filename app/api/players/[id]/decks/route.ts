import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import { listPlayerDecks, insertDeck } from '@/lib/db-decks'

export const runtime = 'edge'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { env } = getRequestContext<CloudflareEnv>()
  const { id } = await params
  const { data, error } = await listPlayerDecks(env.DB, id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { name, commander_image_url, moxfield_url } = await req.json() as { name?: string; commander_image_url?: string; moxfield_url?: string }
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Le nom du deck est requis' }, { status: 400 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const { id } = await params
  const { data, error } = await insertDeck(env.DB, id, {
    name: name.trim(),
    commander_image_url: commander_image_url?.trim() || null,
    moxfield_url: moxfield_url?.trim() || null,
  })
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
