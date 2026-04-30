import { NextRequest, NextResponse } from 'next/server'
import { getAdminCookieOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD non configuré' }, { status: 500 })
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 })
  }

  const response = NextResponse.json({ ok: true })
  const opts = getAdminCookieOptions()
  response.cookies.set(opts)

  return response
}
