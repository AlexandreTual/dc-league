import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest } from '@/lib/auth/api'
import { updateEmail } from '@/lib/auth/service'

export const runtime = 'edge'

export function PATCH(req: NextRequest) {
  return apiRoute(req, 'player', async ({ db, user, body }) => {
    if (body.email !== null && typeof body.email !== 'string') return badRequest('Adresse mail invalide')
    const result = await updateEmail(db, user!, body.email)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result.value)
  })
}
