import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, resultError } from '@/lib/auth/api'
import { gameStub } from '@/lib/games/binding'
import { GAME_SERVER_ERROR, removeTable } from '@/lib/games/remove'

export const runtime = 'edge'

/** Supprime une table et sa partie (parties abandonnées ou de test) : réservé aux admins. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return apiRoute(req, 'admin', async ({ db, env }) => {
    const destroy = async (tableId: string) =>
      (await gameStub(env, tableId).fetch(`https://game/tables/${tableId}`, { method: 'DELETE' })).ok
    const { error } = await removeTable(db, destroy, id)
    if (error !== null) return resultError(error, { 'Table introuvable': 404, [GAME_SERVER_ERROR]: 502 })
    return NextResponse.json({ ok: true })
  })
}
