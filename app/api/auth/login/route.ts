import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, setSessionCookie } from '@/lib/auth/session'
import { loginBootstrap, loginWithPassword, openSession } from '@/lib/auth/service'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const refused = assertSameOrigin(req)
  if (refused) return refused

  const body = (await req.json().catch(() => ({}))) as { username?: unknown; password?: unknown; adminPassword?: unknown }
  const { env } = getRequestContext<CloudflareEnv>()
  const now = new Date()
  // Adresse du client fournie par Cloudflare (absente en local) : limite des tentatives par IP.
  const ip = req.headers.get('CF-Connecting-IP')

  const result =
    typeof body.adminPassword === 'string'
      ? await loginBootstrap(env.DB, { adminPassword: body.adminPassword, ip }, env.ADMIN_PASSWORD, now)
      : await loginWithPassword(
          env.DB,
          {
            username: typeof body.username === 'string' ? body.username : '',
            password: typeof body.password === 'string' ? body.password : '',
            ip,
          },
          now,
        )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const { token, expiresAt } = await openSession(env.DB, result.value.userId, now)
  const res = NextResponse.json({ ok: true })
  setSessionCookie(res, token, expiresAt)
  return res
}
