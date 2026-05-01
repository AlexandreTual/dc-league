import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/auth'
import { closeLeague } from '@/lib/db-leagues'
import { countMatches, countCompletedMatches, hasPlayoffs, listPlayoffs } from '@/lib/db'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }
  const { id } = params

  const { data: total } = countMatches(id)
  const { data: completed } = countCompletedMatches(id)
  if ((total ?? 0) > 0 && total !== completed) {
    return NextResponse.json(
      { error: `Il reste ${(total ?? 0) - (completed ?? 0)} match(s) de ligue à jouer.` },
      { status: 400 }
    )
  }

  const { data: hasP } = hasPlayoffs(id)
  if (hasP) {
    const { data: poffs } = listPlayoffs(id)
    const allDone = poffs?.every((p) => p.is_completed) ?? false
    if (!allDone) {
      return NextResponse.json(
        { error: 'Des matchs de playoffs ne sont pas encore joués.' },
        { status: 400 }
      )
    }
  }

  const { data, error } = closeLeague(id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}
