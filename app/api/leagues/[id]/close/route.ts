import { NextRequest, NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { isAdminAuthenticated } from '@/lib/auth'
import { closeLeague } from '@/lib/db-leagues'
import { countMatches, countCompletedMatches, hasPlayoffs, listPlayoffs } from '@/lib/db'

export const runtime = 'edge'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB
  const { id } = params

  const { data: total } = await countMatches(db, id)
  const { data: completed } = await countCompletedMatches(db, id)
  if ((total ?? 0) > 0 && total !== completed) {
    return NextResponse.json(
      { error: `Il reste ${(total ?? 0) - (completed ?? 0)} match(s) de ligue à jouer.` },
      { status: 400 }
    )
  }

  const { data: hasP } = await hasPlayoffs(db, id)
  if (hasP) {
    const { data: poffs } = await listPlayoffs(db, id)
    const allDone = poffs?.every((p) => p.is_completed) ?? false
    if (!allDone) {
      return NextResponse.json(
        { error: 'Des matchs de playoffs ne sont pas encore joués.' },
        { status: 400 }
      )
    }
  }

  const { data, error } = await closeLeague(db, id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json(data)
}
