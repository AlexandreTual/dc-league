import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth'
import { gameStub } from '@/lib/games/binding'

export const runtime = 'edge'

/** Version provisoire (Tâche 1) : transmet la WebSocket au Durable Object de la table. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('upgrade') !== 'websocket') return NextResponse.json({ error: 'WebSocket attendue' }, { status: 426 })
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 })
  const { id } = await params
  const headers = new Headers({ Upgrade: 'websocket', 'X-Player-Id': user.playerId ?? '' })
  const res = await gameStub(getRequestContext<CloudflareEnv>().env, id).fetch(`https://game/tables/${id}/ws`, { headers })
  return new Response(null, { status: res.status, webSocket: res.webSocket } as ResponseInit)
}
