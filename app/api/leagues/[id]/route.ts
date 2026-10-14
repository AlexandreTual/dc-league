import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { MAX_LENGTH, optionalText } from '@/lib/auth/validation'
import { countScoredMatches, deleteLeague, updateLeague, LEAGUE_NOT_FOUND } from '@/lib/db-leagues'
import { leagueFor } from '@/lib/leagues/route-access'
import { parseVisibility } from '@/lib/leagues/validation'

export const runtime = 'edge'

type Params = { params: Promise<{ id: string }> }

/** Renommer la ligue ou changer sa visibilité. */
export function PATCH(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, body, user }) => {
    const { id } = await params
    const access = await leagueFor(db, id, user, 'manage')
    if (access instanceof NextResponse) return access
    const name = optionalText(body.name, 'Le nom de la ligue', MAX_LENGTH.leagueName)
    if (!name.ok) return badRequest(name.error)
    const visibility = body.visibility === undefined ? undefined : parseVisibility(body.visibility)
    if (visibility && !visibility.ok) return badRequest(visibility.error)
    const { data, error } = await updateLeague(db, id, { name: name.value, visibility: visibility?.value })
    if (error !== null) return resultError(error, { [LEAGUE_NOT_FOUND]: 404 })
    return NextResponse.json(data)
  })
}

/** L'organisateur supprime sa ligue tant qu'aucun score n'est saisi ; un admin, toujours. */
export function DELETE(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, user }) => {
    const { id } = await params
    const access = await leagueFor(db, id, user, 'manage')
    if (access instanceof NextResponse) return access
    if (!access.viewer?.isAdmin) {
      const scored = await countScoredMatches(db, id)
      if (scored.error !== null) return resultError(scored.error)
      if (scored.data > 0) return badRequest('Des scores sont déjà saisis : seul un admin peut supprimer cette ligue.')
    }
    const { error } = await deleteLeague(db, id)
    if (error !== null) return resultError(error, { [LEAGUE_NOT_FOUND]: 404 })
    return NextResponse.json({ ok: true })
  })
}
