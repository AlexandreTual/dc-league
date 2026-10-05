import { NextRequest } from 'next/server'
import { leaveTable } from '@/lib/db-games'
import { gameWrite, resultResponse } from '@/lib/games/http'

export const runtime = 'edge'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return gameWrite(req, async ({ db, user }) => resultResponse(await leaveTable(db, id, user.playerId)))
}
