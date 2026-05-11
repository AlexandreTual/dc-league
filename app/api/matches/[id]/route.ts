import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import { updateMatchScore, resetMatchScore } from '@/lib/db'

export const runtime = 'edge'

const VALID_SCORES = [
  [2, 0], [2, 1], [1, 1], [1, 2], [0, 2],
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { score_p1, score_p2 } = await req.json() as { score_p1: number; score_p2: number }
  const isValid = VALID_SCORES.some(([s1, s2]) => s1 === score_p1 && s2 === score_p2)
  if (!isValid) {
    return NextResponse.json(
      { error: 'Score invalide. Scores BO3 acceptés : 2-0, 2-1, 1-1, 1-2, 0-2' },
      { status: 400 }
    )
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const { data, error } = await updateMatchScore(env.DB, params.id, score_p1, score_p2)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const { data, error } = await resetMatchScore(env.DB, params.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}
