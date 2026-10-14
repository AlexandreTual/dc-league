import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { refuseItemScore } from '@/lib/leagues/item-access'
import { updateMatchScore, resetMatchScore, STATUTS_LIGUE, ERREURS_LIGUE } from '@/lib/db'

export const runtime = 'edge'

const VALID_SCORES = [
  [2, 0], [2, 1], [1, 1], [1, 2], [0, 2],
]

type Params = { params: Promise<{ id: string }> }

export function PATCH(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, body, user }) => {
    const { id } = await params
    const refused = await refuseItemScore(db, 'matches', id, user, ERREURS_LIGUE.matchNotFound)
    if (refused) return refused
    const { score_p1, score_p2 } = body
    const isValid = VALID_SCORES.some(([s1, s2]) => s1 === score_p1 && s2 === score_p2)
    if (!isValid) return badRequest('Score invalide. Scores BO3 acceptés : 2-0, 2-1, 1-1, 1-2, 0-2')

    const { data, error } = await updateMatchScore(db, id, score_p1 as number, score_p2 as number)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json(data)
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'user', async ({ db, user }) => {
    const { id } = await params
    const refused = await refuseItemScore(db, 'matches', id, user, ERREURS_LIGUE.matchNotFound)
    if (refused) return refused
    const { data, error } = await resetMatchScore(db, id)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json(data)
  })
}
