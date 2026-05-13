import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getAdminCookieOptions } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password: string }

  const { env } = getRequestContext<CloudflareEnv>()

  if (!env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD non configuré' }, { status: 500 })
  }

  if (password !== env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  const opts = getAdminCookieOptions(env.ADMIN_PASSWORD)
  response.cookies.set(opts)

  return response
}
