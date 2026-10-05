import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { closeLeague } from '@/lib/db-leagues'
import { countMatches, countCompletedMatches, hasPlayoffs, listPlayoffs } from '@/lib/db'

export const runtime = 'edge'

export function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { id } = await params

    const total = await countMatches(db, id)
    if (total.error !== null) return resultError(total.error)
    const completed = await countCompletedMatches(db, id)
    if (completed.error !== null) return resultError(completed.error)
    if (total.data > 0 && total.data !== completed.data) {
      return badRequest(`Il reste ${total.data - completed.data} match(s) de ligue à jouer.`)
    }

    const hasP = await hasPlayoffs(db, id)
    if (hasP.error !== null) return resultError(hasP.error)
    if (hasP.data) {
      const poffs = await listPlayoffs(db, id)
      if (poffs.error !== null) return resultError(poffs.error)
      if (!poffs.data.every((p) => p.is_completed)) {
        return badRequest('Des matchs de playoffs ne sont pas encore joués.')
      }
    }

    const { data, error } = await closeLeague(db, id)
    if (error !== null) return resultError(error, { 'Ligue introuvable ou déjà archivée.': 404 })
    return NextResponse.json(data)
  })
}
