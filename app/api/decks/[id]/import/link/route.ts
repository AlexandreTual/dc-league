import { NextRequest, NextResponse } from 'next/server'
import { loadEditableDeck } from '@/lib/cards/deck-access'
import { fetchDeckLink, parseDeckLink } from '@/lib/cards/deck-link'

export const runtime = 'edge'

/** Lit un deck Moxfield ou Archidekt et renvoie sa liste au format de l'import texte (rien n'est enregistré). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await loadEditableDeck(req, params)
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { url?: unknown }
  const link = typeof body.url === 'string' ? parseDeckLink(body.url) : null
  if (!link) return NextResponse.json({ error: 'Lien non reconnu (Moxfield ou Archidekt)' }, { status: 400 })

  const result = await fetchDeckLink(link, fetch)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json({ text: result.text, name: result.name })
}
