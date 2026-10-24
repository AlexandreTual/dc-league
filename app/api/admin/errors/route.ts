import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, resultError } from '@/lib/auth/api'
import { clearErrors } from '@/lib/db-errors'

export const runtime = 'edge'

/** Vide le journal des erreurs : réservé aux admins. */
export async function DELETE(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { error } = await clearErrors(db)
    if (error !== null) return resultError(error)
    return NextResponse.json({ ok: true })
  })
}
