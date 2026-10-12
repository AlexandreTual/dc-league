import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { MAX_LENGTH, requiredText } from '@/lib/auth/validation'
import { listLeaguesFor, createLeague, enrollLeaguePlayer } from '@/lib/db-leagues'
import { viewerOf } from '@/lib/leagues/access'
import { parseVisibility } from '@/lib/leagues/validation'

export const runtime = 'edge'

/** Ligues visibles par l'appelant (publiques pour un visiteur). */
export function GET(req: NextRequest) {
  return apiRoute(req, 'viewer', async ({ db, user }) => {
    const { data, error } = await listLeaguesFor(db, viewerOf(user))
    if (error !== null) return resultError(error)
    return NextResponse.json(data)
  })
}

/** Tout joueur crée une ligue : il en devient l'organisateur et y est inscrit (il peut se désinscrire). */
export function POST(req: NextRequest) {
  return apiRoute(req, 'player', async ({ db, body, user }) => {
    const name = requiredText(body.name, 'Le nom de la ligue', MAX_LENGTH.leagueName)
    if (!name.ok) return badRequest(name.error)
    const visibility = parseVisibility(body.visibility ?? 'public')
    if (!visibility.ok) return badRequest(visibility.error)
    const { data, error } = await createLeague(db, { name: name.value, ownerPlayerId: user!.playerId, visibility: visibility.value })
    if (error !== null) return resultError(error)
    const enrolled = await enrollLeaguePlayer(db, data.id, user!.playerId)
    if (enrolled.error !== null) return resultError(enrolled.error)
    return NextResponse.json(data, { status: 201 })
  })
}
