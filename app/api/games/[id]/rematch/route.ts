import { NextRequest } from 'next/server'
import { createRematch } from '@/lib/db-games'
import { gameWrite, resultResponse } from '@/lib/games/http'

export const runtime = 'edge'

/** Revanche d'une partie finie : la crée (le demandeur en est l'hôte) ou la rejoint, avec le deck de la partie. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return gameWrite(req, async ({ db, user }) => resultResponse(await createRematch(db, id, user.playerId)))
}
