import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, currentSessionIdHash, requirePlayer } from '@/lib/auth/session'
import { changePassword } from '@/lib/auth/service'

export const runtime = 'edge'

export async function PATCH(req: NextRequest) {
  const refused = assertSameOrigin(req)
  if (refused) return refused
  const user = await requirePlayer()
  if (user instanceof NextResponse) return user

  const body = (await req.json().catch(() => ({}))) as { currentPassword?: string; newPassword?: string }
  const { env } = getRequestContext<CloudflareEnv>()
  const result = await changePassword(
    env.DB,
    user,
    { currentPassword: body.currentPassword ?? '', newPassword: body.newPassword ?? '' },
    (await currentSessionIdHash()) ?? '',
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ ok: true })
}
