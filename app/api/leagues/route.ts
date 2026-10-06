import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, resultError } from '@/lib/auth/api'
import { MAX_LENGTH, requiredText } from '@/lib/auth/validation'
import { listLeagues, createLeague } from '@/lib/db-leagues'

export const runtime = 'edge'

export function GET(req: NextRequest) {
  return apiRoute(req, 'public', async ({ db }) => {
    const { data, error } = await listLeagues(db)
    if (error !== null) return resultError(error)
    return NextResponse.json(data)
  })
}

export function POST(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db, body }) => {
    const name = requiredText(body.name, 'Le nom de la saison', MAX_LENGTH.leagueName)
    if (!name.ok) return badRequest(name.error)
    const { data, error } = await createLeague(db, name.value)
    if (error !== null) return resultError(error, { 'Une ligue est déjà active.': 409 })
    return NextResponse.json(data, { status: 201 })
  })
}
