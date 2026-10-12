// Droit de saisir le score d'un match : gérer la ligue de ce match.
import { NextResponse } from 'next/server'
import { resultError } from '@/lib/auth/api-core'
import type { CurrentUser } from '@/lib/auth/types'
import { getItemLeagueId } from '@/lib/db-leagues'
import { leagueFor } from './route-access'

/** null si l'appelant peut gérer la ligue du match, sinon la réponse d'erreur (404 si le match est introuvable). */
export async function refuseItemScore(
  db: D1Database,
  table: 'matches' | 'playoffs',
  id: string,
  user: CurrentUser | null,
  notFound: string,
): Promise<NextResponse | null> {
  const { data: leagueId, error } = await getItemLeagueId(db, table, id)
  if (error !== null) return resultError(error)
  if (!leagueId) return NextResponse.json({ error: notFound }, { status: 404 })
  const access = await leagueFor(db, leagueId, user, 'manage')
  return access instanceof NextResponse ? access : null
}
