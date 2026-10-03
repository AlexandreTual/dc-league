import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, setSessionCookie } from '@/lib/auth/session'
import { acceptInvitation, openSession } from '@/lib/auth/service'

export const runtime = 'edge'

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const refused = assertSameOrigin(req)
  if (refused) return refused

  const { token } = await params
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string; passwordConfirm?: string }
  const { env } = getRequestContext<CloudflareEnv>()
  const now = new Date()

  const result = await acceptInvitation(
    env.DB,
    token,
    { username: body.username, password: body.password ?? '', passwordConfirm: body.passwordConfirm ?? '' },
    now,
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const session = await openSession(env.DB, result.value.userId, now)
  const res = NextResponse.json({ ok: true })
  setSessionCookie(res, session.token, session.expiresAt)
  return res
}
