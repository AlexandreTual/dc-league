import { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { requirePlayer } from '@/lib/auth'
import { resultResponse } from '@/lib/games/http'
import { myTableTokens } from '@/lib/games/tokens'

export const runtime = 'edge'

/** Jetons du deck du joueur connecté à cette table (onglet « Du deck » de « Créer un jeton »). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePlayer()
  if (user instanceof NextResponse) return user
  const { id } = await params
  return resultResponse(await myTableTokens(getRequestContext<CloudflareEnv>().env.DB, id, user.playerId))
}
