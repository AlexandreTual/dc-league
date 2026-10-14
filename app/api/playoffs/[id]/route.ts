import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { refuseItemScore } from '@/lib/leagues/item-access'
import { updatePlayoffScore, resetPlayoffScore, STATUTS_LIGUE, ERREURS_LIGUE } from '@/lib/db'

export const runtime = 'edge'

// Pas de nul (1-1) en playoff — il faut un vainqueur
const VALID_SCORES = [
  [2, 0], [2, 1], [1, 2], [0, 2],
]

type Params = { params: Promise<{ id: string }> }

export function PATCH(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, body, user }) => {
    const { id } = await params
    const refused = await refuseItemScore(db, 'playoffs', id, user, ERREURS_LIGUE.playoffNotFound)
    if (refused) return refused
    const { score_p1, score_p2 } = body
    const isValid = VALID_SCORES.some(([s1, s2]) => s1 === score_p1 && s2 === score_p2)
    if (!isValid) {
      return badRequest('Score invalide. Scores acceptés en playoffs : 2-0, 2-1, 1-2, 0-2 (pas de match nul)')
    }

    const { data, error } = await updatePlayoffScore(db, id, score_p1 as number, score_p2 as number)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json(data)
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, user }) => {
    const { id } = await params
    const refused = await refuseItemScore(db, 'playoffs', id, user, ERREURS_LIGUE.playoffNotFound)
    if (refused) return refused
    const { data, error } = await resetPlayoffScore(db, id)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json(data)
  })
}
