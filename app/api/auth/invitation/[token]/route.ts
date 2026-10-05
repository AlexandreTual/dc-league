import { NextRequest, NextResponse } from 'next/server'
import { apiRoute } from '@/lib/auth/api'
import { setSessionCookie } from '@/lib/auth/session'
import { acceptInvitation, openSession } from '@/lib/auth/service'

export const runtime = 'edge'

const text = (v: unknown) => (typeof v === 'string' ? v : '')

export function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return apiRoute(req, 'public', async ({ db, body }) => {
    const { token } = await params
    const now = new Date()

    const result = await acceptInvitation(
      db,
      token,
      {
        username: typeof body.username === 'string' ? body.username : undefined,
        password: text(body.password),
        passwordConfirm: text(body.passwordConfirm),
      },
      now,
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    // openSession peut lever une erreur : apiRoute la transforme en 500 en français.
    const session = await openSession(db, result.value.userId, now)
    const res = NextResponse.json({ ok: true })
    setSessionCookie(res, session.token, session.expiresAt)
    return res
  })
}
