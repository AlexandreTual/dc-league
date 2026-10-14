import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { apiRoute } from '@/lib/auth/api'
import { requestPasswordReset } from '@/lib/auth/service'
import { mailContext } from '@/lib/mail/env'

export const runtime = 'edge'

export function POST(req: NextRequest) {
  return apiRoute(req, 'public', async ({ db, body }) => {
    const identifier = typeof body.identifier === 'string' ? body.identifier : ''
    if (identifier.trim()) {
      // Traité après la réponse : même réponse et même durée, que le compte existe ou non.
      const work = requestPasswordReset(db, identifier, new Date(), mailContext(req))
      try {
        getRequestContext().ctx.waitUntil(work)
      } catch {
        await work
      }
    }
    return NextResponse.json({ ok: true })
  })
}
