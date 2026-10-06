import { NextRequest, NextResponse } from 'next/server'
import { apiRoute } from '@/lib/auth/api'
import { setSessionCookie } from '@/lib/auth/session'
import { loginBootstrap, loginWithPassword, openSession } from '@/lib/auth/service'

export const runtime = 'edge'

const text = (v: unknown) => (typeof v === 'string' ? v : '')

export function POST(req: NextRequest) {
  return apiRoute(req, 'public', async ({ db, env, body }) => {
    const now = new Date()
    // Adresse du client fournie par Cloudflare (absente en local) : limite des tentatives par IP.
    const ip = req.headers.get('CF-Connecting-IP')

    const result =
      typeof body.adminPassword === 'string'
        ? await loginBootstrap(db, { adminPassword: body.adminPassword, ip }, env.ADMIN_PASSWORD, now)
        : await loginWithPassword(db, { username: text(body.username), password: text(body.password), ip }, now)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    // openSession peut lever une erreur : apiRoute la transforme en 500 en français.
    const { token, expiresAt } = await openSession(db, result.value.userId, now)
    const res = NextResponse.json({ ok: true })
    setSessionCookie(res, token, expiresAt)
    return res
  })
}
