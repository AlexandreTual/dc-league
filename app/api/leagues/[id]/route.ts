import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, resultError } from '@/lib/auth/api'
import { deleteLeague } from '@/lib/db-leagues'

export const runtime = 'edge'

export function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { id } = await params
    const { error } = await deleteLeague(db, id)
    if (error !== null) return resultError(error, { 'Ligue introuvable.': 404 })
    return NextResponse.json({ ok: true })
  })
}
