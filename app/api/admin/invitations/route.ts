import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, requireAdmin } from '@/lib/auth/session'
import { issueInvitation } from '@/lib/auth/service'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const refused = assertSameOrigin(req)
  if (refused) return refused
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const body = (await req.json().catch(() => ({}))) as { player_id?: string; kind?: string; grant_admin?: boolean }
  if (!body.player_id || (body.kind !== 'signup' && body.kind !== 'reset')) {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const result = await issueInvitation(
    env.DB,
    { playerId: body.player_id, kind: body.kind, grantAdmin: body.grant_admin === true },
    new Date(),
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(
    { url: new URL(`/invitation/${result.value.token}`, req.url).toString(), expiresAt: result.value.expiresAt },
    { status: 201 },
  )
}
