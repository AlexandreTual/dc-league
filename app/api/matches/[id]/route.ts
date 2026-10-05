import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { updateMatchScore, resetMatchScore, STATUTS_LIGUE } from '@/lib/db'

export const runtime = 'edge'

const VALID_SCORES = [
  [2, 0], [2, 1], [1, 1], [1, 2], [0, 2],
]

type Params = { params: Promise<{ id: string }> }

export function PATCH(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'admin', async ({ db, body }) => {
    const { score_p1, score_p2 } = body
    const isValid = VALID_SCORES.some(([s1, s2]) => s1 === score_p1 && s2 === score_p2)
    if (!isValid) return badRequest('Score invalide. Scores BO3 acceptés : 2-0, 2-1, 1-1, 1-2, 0-2')

    const { id } = await params
    const { data, error } = await updateMatchScore(db, id, score_p1 as number, score_p2 as number)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json(data)
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { id } = await params
    const { data, error } = await resetMatchScore(db, id)
    if (error !== null) return resultError(error, STATUTS_LIGUE)
    return NextResponse.json(data)
  })
}
