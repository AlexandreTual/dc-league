import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, resultError } from '@/lib/auth/api'
import { listTestMails } from '@/lib/db-auth'

export const runtime = 'edge'

/** Boîte de test (MAIL_TEST=1 dans .dev.vars) : introuvable partout ailleurs. */
export function GET(req: NextRequest) {
  return apiRoute(req, 'public', async ({ db, env }) => {
    if (env.MAIL_TEST !== '1') return NextResponse.json({ error: 'Page introuvable' }, { status: 404 })
    const { data, error } = await listTestMails(db)
    if (error !== null) return resultError(error)
    return NextResponse.json({ mails: data })
  })
}
