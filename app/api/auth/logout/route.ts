import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, clearSessionCookie, currentSessionIdHash } from '@/lib/auth/session'
import { deleteSession } from '@/lib/db-auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const refused = assertSameOrigin(req)
  if (refused) return refused

  const idHash = await currentSessionIdHash()
  if (idHash) {
    const { env } = getRequestContext<CloudflareEnv>()
    await deleteSession(env.DB, idHash)
  }
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
}
