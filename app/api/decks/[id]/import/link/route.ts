import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest } from '@/lib/auth/api'
import { editableDeck } from '@/lib/cards/deck-access'
import { fetchDeckLink, parseDeckLink } from '@/lib/cards/deck-link'

export const runtime = 'edge'

/** Lit un deck Moxfield ou Archidekt et renvoie sa liste au format de l'import texte (rien n'est enregistré). */
export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'user', editableDeck(params, async ({ body }) => {
    const link = typeof body.url === 'string' ? parseDeckLink(body.url) : null
    if (!link) return badRequest('Lien non reconnu (Moxfield ou Archidekt)')

    const result = await fetchDeckLink(link, fetch)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
    return NextResponse.json({ text: result.text, name: result.name })
  }))
}
