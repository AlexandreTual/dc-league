import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, resultError } from '@/lib/auth/api'
import { destroyGame } from '@/lib/games/binding'
import { GAME_SERVER_ERROR, removeTable } from '@/lib/games/remove'

export const runtime = 'edge'

/** Supprime une table et sa partie (parties abandonnées ou de test) : réservé aux admins. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return apiRoute(req, 'admin', async ({ db, env }) => {
    const { error } = await removeTable(db, destroyGame(env), id)
    if (error !== null) return resultError(error, { [GAME_SERVER_ERROR]: 502 })
    return NextResponse.json({ ok: true })
  })
}
