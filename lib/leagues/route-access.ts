// Chargement d'une ligue avec les droits de l'appelant (voir ou gérer), pour les routes API et les pages.
import { NextResponse } from 'next/server'
import { resultError } from '@/lib/auth/api-core'
import type { CurrentUser } from '@/lib/auth/types'
import { getLeague, isLeagueMember, LEAGUE_NOT_FOUND, type DbLeague } from '@/lib/db-leagues'
import { canManageLeague, canViewLeague, viewerOf, type Viewer } from './access'

export const MANAGE_REFUSED = "Réservé à l'organisateur de la ligue."

export type LeagueAccess = { league: DbLeague; viewer: Viewer; isMember: boolean; canManage: boolean }

/** Ligue et droits de l'appelant ; 'not-found' si elle est absente ou invisible pour lui ; { error } si la base échoue. */
export async function resolveLeagueAccess(
  db: D1Database,
  id: string,
  user: CurrentUser | null,
): Promise<LeagueAccess | 'not-found' | { error: string }> {
  const { data: league, error } = await getLeague(db, id)
  if (error !== null) return { error }
  if (!league) return 'not-found'
  const viewer = viewerOf(user)
  let isMember = false
  if (viewer && viewer.playerId) {
    const member = await isLeagueMember(db, id, viewer.playerId)
    if (member.error !== null) return { error: member.error }
    isMember = member.data
  }
  if (!canViewLeague(league, viewer, isMember)) return 'not-found'
  return { league, viewer, isMember, canManage: canManageLeague(league, viewer) }
}

/**
 * Pour une route API. Ligue introuvable ou invisible : 404 (une ligue privée ne révèle pas son existence).
 * Visible mais pas gérable alors qu'il faut la gérer : 403.
 */
export async function leagueFor(
  db: D1Database,
  id: string,
  user: CurrentUser | null,
  need: 'view' | 'manage',
): Promise<LeagueAccess | NextResponse> {
  const access = await resolveLeagueAccess(db, id, user)
  if (access === 'not-found') return NextResponse.json({ error: LEAGUE_NOT_FOUND }, { status: 404 })
  if ('error' in access) return resultError(access.error)
  if (need === 'manage' && !access.canManage) return NextResponse.json({ error: MANAGE_REFUSED }, { status: 403 })
  return access
}
