import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, requireAdmin } from '@/lib/auth/session'
import { AUTH_ERR, setAdmin } from '@/lib/db-auth'

export const runtime = 'edge'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const refused = assertSameOrigin(req)
  if (refused) return refused
  const admin = await requireAdmin()
  if (admin instanceof NextResponse) return admin

  const body = (await req.json().catch(() => ({}))) as { is_admin?: boolean }
  if (typeof body.is_admin !== 'boolean') return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })

  const { env } = getRequestContext<CloudflareEnv>()
  const { id } = await params
  const { error } = await setAdmin(env.DB, id, body.is_admin)
  if (error === AUTH_ERR.LAST_ADMIN) return NextResponse.json({ error: 'Il doit rester au moins un admin' }, { status: 409 })
  if (error === AUTH_ERR.NOT_FOUND) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
  if (error !== null) return NextResponse.json({ error: 'Erreur interne, réessaie plus tard' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
