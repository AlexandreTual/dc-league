import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest } from '@/lib/auth/api'
import { issueInvitation } from '@/lib/auth/service'
import { mailContext } from '@/lib/mail/env'
import { mailLang } from '@/lib/mail/templates'

export const runtime = 'edge'

export function POST(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db, body }) => {
    const { player_id: playerId, kind, email } = body
    if (typeof playerId !== 'string' || !playerId || (kind !== 'signup' && kind !== 'reset')) return badRequest('Requête invalide')
    if (email !== undefined && email !== null && typeof email !== 'string') return badRequest('Adresse mail invalide')
    // Langue du mail, choisie par l'admin (français par défaut).
    const lang = mailLang(body.lang)
    if (!lang) return badRequest('Requête invalide')

    const result = await issueInvitation(
      db,
      { playerId, kind, grantAdmin: body.grant_admin === true, email: typeof email === 'string' ? email : null },
      new Date(),
      { ...mailContext(req), lang },
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result.value, { status: 201 })
  })
}
