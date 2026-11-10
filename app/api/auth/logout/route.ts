import { NextRequest, NextResponse } from 'next/server'
import { apiRoute } from '@/lib/auth/api'
import { clearSessionCookie, currentSessionIdHash } from '@/lib/auth/session'
import { deleteSession } from '@/lib/db-auth'

export const runtime = 'edge'

export function POST(req: NextRequest) {
  return apiRoute(req, 'public', async ({ db }) => {
    const idHash = await currentSessionIdHash()
    if (idHash) await deleteSession(db, idHash)
    const res = NextResponse.json({ ok: true })
    clearSessionCookie(res)
    return res
  })
}
