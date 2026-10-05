import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, getCurrentUser } from '@/lib/auth'
import { getTable } from '@/lib/db-games'
import { gameStub } from '@/lib/games/binding'

export const runtime = 'edge'

/**
 * Connexion en direct à une partie : session et origine vérifiées ici, puis WebSocket transmise
 * au Durable Object de la table. Seul le site pose X-Player-Id (joueur assis) ou X-Spectator.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return NextResponse.json({ error: 'WebSocket attendue' }, { status: 426 })
  }
  const forbidden = assertSameOrigin(req)
  if (forbidden) return forbidden
  const user = await getCurrentUser()
  if (!user || user.isBootstrap) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 })

  const { id } = await params
  const { env } = getRequestContext<CloudflareEnv>()
  const { data: table } = await getTable(env.DB, id)
  if (!table || table.status === 'open' || table.status === 'starting') return NextResponse.json({ error: 'Partie introuvable' }, { status: 404 })

  // En-têtes reconstruits : rien de ce que le navigateur envoie ne passe, hormis la poignée de main WebSocket.
  const headers = new Headers({ Upgrade: 'websocket' })
  for (const name of ['sec-websocket-key', 'sec-websocket-version', 'sec-websocket-extensions', 'sec-websocket-protocol']) {
    const value = req.headers.get(name)
    if (value) headers.set(name, value)
  }
  const seated = table.players.some((p) => p.playerId === user.playerId)
  headers.set(seated ? 'X-Player-Id' : 'X-Spectator', seated ? user.playerId : '1')

  const res = await gameStub(env, id).fetch(`https://game/tables/${id}/ws`, { headers })
  // next-on-pages ne conserve la WebSocket que si elle est explicitement passée (voir scripts/patch-next-on-pages.mjs).
  return new Response(res.body, { status: res.status, headers: res.headers, webSocket: res.webSocket } as ResponseInit)
}
