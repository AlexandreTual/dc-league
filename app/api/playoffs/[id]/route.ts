import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import { updatePlayoffScore, resetPlayoffScore } from '@/lib/db'

export const runtime = 'edge'

// Pas de nul (1-1) en playoff — il faut un vainqueur
const VALID_SCORES = [
  [2, 0], [2, 1], [1, 2], [0, 2],
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
  const { id } = await params
  const { data, error } = await updatePlayoffScore(env.DB, id, score_p1, score_p2)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const { id } = await params
  const { data, error } = await resetPlayoffScore(env.DB, id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}
