import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { updatePlayoffScore, resetPlayoffScore } from '@/lib/db'

// Pas de nul (1-1) en playoff — il faut un vainqueur
const VALID_SCORES = [
  [2, 0], [2, 1], [1, 2], [0, 2],
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { score_p1, score_p2 } = await req.json()

  const isValid = VALID_SCORES.some(([s1, s2]) => s1 === score_p1 && s2 === score_p2)
  if (!isValid) {
    return NextResponse.json(
      { error: 'Score invalide. Scores BO3 acceptés : 2-0, 2-1, 1-1, 1-2, 0-2' },
      { status: 400 }
    )
  }

  const { data, error } = updatePlayoffScore(params.id, score_p1, score_p2)
  if (error) return NextResponse.json({ error }, { status: 500 })

  // Retourne le match mis à jour + les matchs auto-générés (finale/petite finale)
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { data, error } = resetPlayoffScore(params.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}
