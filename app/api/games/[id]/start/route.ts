import { NextRequest } from 'next/server'
import { gameStub } from '@/lib/games/binding'
import { gameWrite, resultResponse } from '@/lib/games/http'
import { startTable, type GameInit } from '@/lib/games/start'

export const runtime = 'edge'

/** L'hôte démarre la partie : création dans le Durable Object, puis table en cours. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return gameWrite(req, async ({ db, env, user }) => {
    const init: GameInit = async (tableId, body) => {
      const res = await gameStub(env, tableId).fetch(`https://game/tables/${tableId}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, ...body }),
      })
      return { ok: res.ok, status: res.status }
    }
    return resultResponse(await startTable(db, init, id, user.playerId))
  })
}
