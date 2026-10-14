import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, resultError } from '@/lib/auth/api'
import { renewInviteToken, LEAGUE_NOT_FOUND } from '@/lib/db-leagues'
import { leagueFor } from '@/lib/leagues/route-access'

export const runtime = 'edge'

/** Crée ou renouvelle le lien d'invitation : l'ancien cesse de marcher. */
export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'user', async ({ db, user }) => {
    const { id } = await params
    const access = await leagueFor(db, id, user, 'manage')
    if (access instanceof NextResponse) return access
    const { data, error } = await renewInviteToken(db, id)
    if (error !== null) return resultError(error, { [LEAGUE_NOT_FOUND]: 404 })
    return NextResponse.json({ token: data })
  })
}
