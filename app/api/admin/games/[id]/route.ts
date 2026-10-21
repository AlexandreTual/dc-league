import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, resultError } from '@/lib/auth/api'
import { destroyGame } from '@/lib/games/binding'
import { IDLE_AFTER_MS } from '@/lib/games/idle'
import { GAME_SERVER_ERROR, removeTable, TABLE_ACTIVE_ERROR } from '@/lib/games/remove'

export const runtime = 'edge'

/**
 * Supprime une table et sa partie (parties abandonnées ou de test) : réservé aux admins.
 * `?inactive=1` (suppression groupée) : refusée si la table a eu de l'activité depuis moins de 24 h.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idleOnly = req.nextUrl.searchParams.get('inactive') === '1'
  return apiRoute(req, 'admin', async ({ db, env }) => {
    const opts = idleOnly ? { idleBefore: new Date(Date.now() - IDLE_AFTER_MS) } : {}
    const { error } = await removeTable(db, destroyGame(env), id, opts)
    if (error !== null) return resultError(error, { [GAME_SERVER_ERROR]: 502, [TABLE_ACTIVE_ERROR]: 409 })
    return NextResponse.json({ ok: true })
  })
}
