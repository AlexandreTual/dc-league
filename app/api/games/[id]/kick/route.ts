import { NextRequest, NextResponse } from 'next/server'
import { removeSeat } from '@/lib/db-games'
import { gameWrite, resultResponse } from '@/lib/games/http'

export const runtime = 'edge'

/** L'hôte retire un joueur avant le départ. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return gameWrite(req, async ({ db, user, body }) => {
    if (typeof body.playerId !== 'string') return NextResponse.json({ error: 'Joueur manquant' }, { status: 400 })
    return resultResponse(await removeSeat(db, id, user.playerId, body.playerId))
  })
}
