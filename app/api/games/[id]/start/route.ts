import { NextRequest } from 'next/server'
import { createScryfallClient } from '@/lib/cards/scryfall'
import { gameStub } from '@/lib/games/binding'
import { gameWrite, resultResponse } from '@/lib/games/http'
import { startTable, type GameInit } from '@/lib/games/start'

export const runtime = 'edge'

/** L'hôte démarre la partie (premier joueur choisi en option) : création dans le Durable Object, puis table en cours. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return gameWrite(req, async ({ db, env, user, body }) => {
    const init: GameInit = async (tableId, body) => {
      const res = await gameStub(env, tableId).fetch(`https://game/tables/${tableId}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId, ...body }),
      })
      return { ok: res.ok, status: res.status }
    }
    const firstPlayer = typeof body.firstPlayer === 'string' ? body.firstPlayer : undefined
    const scryfall = createScryfallClient({ fetch, sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) })
    return resultResponse(await startTable(db, init, id, user.playerId, firstPlayer, scryfall))
  })
}
