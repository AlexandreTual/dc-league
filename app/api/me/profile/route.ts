import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, requirePlayer } from '@/lib/auth/session'
import { updatePlayerProfile } from '@/lib/db'

export const runtime = 'edge'

export async function PATCH(req: NextRequest) {
  const refused = assertSameOrigin(req)
  if (refused) return refused
  const user = await requirePlayer()
  if (user instanceof NextResponse) return user

  const body = (await req.json().catch(() => ({}))) as { name?: string; avatar_url?: string | null }
  let avatarUrl: string | null | undefined = undefined
  if (body.avatar_url !== undefined) {
    avatarUrl = body.avatar_url?.trim() || null
    if (avatarUrl && !avatarUrl.startsWith('https://')) {
      return NextResponse.json({ error: "L'avatar doit être une URL https" }, { status: 400 })
    }
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const { data, error } = await updatePlayerProfile(env.DB, user.playerId, { name: body.name, avatar_url: avatarUrl })
  if (error === 'Le nom est requis') return NextResponse.json({ error }, { status: 400 })
  if (error !== null) return NextResponse.json({ error: 'Erreur interne, réessaie plus tard' }, { status: 500 })
  return NextResponse.json(data)
}
