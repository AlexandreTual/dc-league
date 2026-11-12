import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, conflict, dbFailure } from '@/lib/auth/api'
import { AUTH_ERR, setAdmin } from '@/lib/db-auth'

export const runtime = 'edge'

export function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'admin', async ({ db, body }) => {
    if (typeof body.is_admin !== 'boolean') return badRequest('Requête invalide')

    const { id } = await params
    const { error } = await setAdmin(db, id, body.is_admin)
    if (error === AUTH_ERR.LAST_ADMIN) return conflict('Il doit rester au moins un admin')
    if (error === AUTH_ERR.NOT_FOUND) return NextResponse.json({ error: 'Compte introuvable' }, { status: 404 })
    if (error !== null) return dbFailure(error)
    return NextResponse.json({ ok: true })
  })
}
