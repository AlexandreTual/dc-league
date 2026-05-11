import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import { deleteLeague } from '@/lib/db-leagues'

export const runtime = 'edge'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { env } = getRequestContext<CloudflareEnv>()
  const { error } = await deleteLeague(env.DB, params.id)
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
