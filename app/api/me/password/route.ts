import { NextRequest, NextResponse } from 'next/server'
import { apiRoute } from '@/lib/auth/api'
import { currentSessionIdHash } from '@/lib/auth/session'
import { changePassword } from '@/lib/auth/service'

export const runtime = 'edge'

const text = (v: unknown) => (typeof v === 'string' ? v : '')

export function PATCH(req: NextRequest) {
  return apiRoute(req, 'player', async ({ db, user, body }) => {
    const result = await changePassword(
      db,
      user!,
      { currentPassword: text(body.currentPassword), newPassword: text(body.newPassword) },
      (await currentSessionIdHash()) ?? '',
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ ok: true })
  })
}
