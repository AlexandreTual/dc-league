import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { countMatches, STATUTS_LIGUE } from '@/lib/db'
import { enrollLeaguePlayer, getLeagueByInviteToken, isLeagueMember } from '@/lib/db-leagues'
import { joinRefusal, INVITE_INVALID } from '@/lib/leagues/join'

export const runtime = 'edge'

/** Rejoindre une ligue par son lien d'invitation (il faut déjà un compte). */
export function POST(req: NextRequest) {
  return apiRoute(req, 'player', async ({ db, body, user }) => {
    const token = typeof body.token === 'string' ? body.token : ''
    const { data: league, error } = await getLeagueByInviteToken(db, token)
    if (error !== null) return resultError(error)
    if (!league) return NextResponse.json({ error: INVITE_INVALID }, { status: 404 })

    const member = await isLeagueMember(db, league.id, user!.playerId)
    if (member.error !== null) return resultError(member.error)
    if (member.data) return NextResponse.json({ league_id: league.id, already: true })

    const matches = await countMatches(db, league.id)
    if (matches.error !== null) return resultError(matches.error)
    const refusal = joinRefusal(league, matches.data)
    if (refusal) return badRequest(refusal)

    const enrolled = await enrollLeaguePlayer(db, league.id, user!.playerId)
    if (enrolled.error !== null) return resultError(enrolled.error, STATUTS_LIGUE)
    return NextResponse.json({ league_id: league.id }, { status: 201 })
  })
}
