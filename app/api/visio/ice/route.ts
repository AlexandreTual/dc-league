import { NextResponse } from 'next/server'
import { localized } from '@/lib/auth/api'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth'
import { iceServersFor } from '@/lib/visio/ice'

export const runtime = 'edge'

/** Serveurs ICE de la visio (relais TURN temporaires si configurés, docs/visio.md) ; joueurs connectés seulement. */
export const GET = localized(async function GET() {
  const user = await getCurrentUser()
  if (!user || user.isBootstrap) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 })
  const { env } = getRequestContext<CloudflareEnv>()
  return NextResponse.json({ iceServers: await iceServersFor(env) }, { headers: { 'Cache-Control': 'no-store' } })
})
