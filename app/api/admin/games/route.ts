import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, dbFailure } from '@/lib/auth/api'
import { unfinishedTables } from '@/lib/db-games'

export const runtime = 'edge'

/** Tables non terminées, relues par l'admin juste avant la suppression groupée des parties inactives. */
export function GET(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db }) => {
    const { data, error } = await unfinishedTables(db)
    if (error !== null) return dbFailure(error)
    return NextResponse.json(data)
  })
}
