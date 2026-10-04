import { NextRequest, NextResponse } from 'next/server'
import { INTERNAL_ERROR, loadEditableDeck } from '@/lib/cards/deck-access'
import { validateBatch } from '@/lib/cards/parse'
import { resolveLines } from '@/lib/cards/resolve'
import { createScryfallClient, ScryfallUnavailableError } from '@/lib/cards/scryfall'

export const runtime = 'edge'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await loadEditableDeck(req, params)
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { lines?: unknown }
  const lines = validateBatch(body.lines)
  if (!lines) return NextResponse.json({ error: 'Paquet invalide' }, { status: 400 })

  const client = createScryfallClient({ fetch, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) })
  try {
    return NextResponse.json(await resolveLines(ctx.db, client, lines, new Date()))
  } catch (e) {
    if (e instanceof ScryfallUnavailableError) {
      return NextResponse.json({ error: 'Scryfall ne répond pas, réessaie dans un instant' }, { status: 503 })
    }
    console.error('[import]', e)
    return NextResponse.json({ error: INTERNAL_ERROR }, { status: 500 })
  }
}
