import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { updatePlayoffScore, resetPlayoffScore } from '@/lib/db'

export const runtime = 'edge'

// Pas de nul (1-1) en playoff — il faut un vainqueur
const VALID_SCORES = [
  [2, 0], [2, 1], [1, 2], [0, 2],
]

type Params = { params: Promise<{ id: string }> }

export function PATCH(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'admin', async ({ db, body }) => {
    const { score_p1, score_p2 } = body
    const isValid = VALID_SCORES.some(([s1, s2]) => s1 === score_p1 && s2 === score_p2)
    if (!isValid) {
      return badRequest('Score invalide. Scores acceptés en playoffs : 2-0, 2-1, 1-2, 0-2 (pas de match nul)')
    }

    const { id } = await params
    const { data, error } = await updatePlayoffScore(db, id, score_p1 as number, score_p2 as number)
    if (error !== null) return resultError(error, { 'Playoff introuvable': 404 })
    return NextResponse.json(data)
  })
}

export function DELETE(req: NextRequest, { params }: Params) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { id } = await params
    const { data, error } = await resetPlayoffScore(db, id)
    if (error !== null) return resultError(error)
    return NextResponse.json(data)
  })
}
