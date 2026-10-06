import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { createScryfallClient } from '@/lib/cards/scryfall'
import { isOracleId, loadRulings, RULINGS_UNAVAILABLE } from '@/lib/cards/rulings'

export const runtime = 'edge'

/** Règles d'une carte déjà importée sur le site (rien d'autre n'est renvoyé). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ oracleId: string }> }) {
  const { oracleId } = await params
  if (!isOracleId(oracleId)) return NextResponse.json({ error: 'Carte introuvable' }, { status: 404 })

  const { env } = getRequestContext<CloudflareEnv>()
  const client = createScryfallClient({ fetch, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) })
  try {
    const result = await loadRulings(env.DB, client, oracleId, new Date())
    if (result.status === 'unknown') return NextResponse.json({ error: 'Carte introuvable' }, { status: 404 })
    if (result.status === 'unavailable') return NextResponse.json({ error: RULINGS_UNAVAILABLE }, { status: 503 })
    return NextResponse.json({ rulings: result.rulings })
  } catch (e) {
    console.error('[rulings]', e)
    return NextResponse.json({ error: RULINGS_UNAVAILABLE }, { status: 503 })
  }
}
