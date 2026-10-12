// Chargement d'une ligue dans une route API, avec le droit demandé (voir ou gérer).
import { NextResponse } from 'next/server'
import { resultError } from '@/lib/auth/api-core'
import type { CurrentUser } from '@/lib/auth/types'
import { getLeague, isLeagueMember, LEAGUE_NOT_FOUND, type DbLeague } from '@/lib/db-leagues'
import { canManageLeague, canViewLeague, viewerOf, type Viewer } from './access'

export const MANAGE_REFUSED = "Réservé à l'organisateur de la ligue."

export type LeagueAccess = { league: DbLeague; viewer: Viewer; isMember: boolean; canManage: boolean }

/**
 * Ligue introuvable ou invisible pour l'appelant : 404 (une ligue privée ne révèle pas son existence).
 * Visible mais pas gérable alors qu'il faut la gérer : 403.
 */
export async function leagueFor(
  db: D1Database,
  id: string,
  user: CurrentUser | null,
  need: 'view' | 'manage',
): Promise<LeagueAccess | NextResponse> {
  const { data: league, error } = await getLeague(db, id)
  if (error !== null) return resultError(error)
  if (!league) return NextResponse.json({ error: LEAGUE_NOT_FOUND }, { status: 404 })
  const viewer = viewerOf(user)
  let isMember = false
  if (viewer && viewer.playerId) {
    const member = await isLeagueMember(db, id, viewer.playerId)
    if (member.error !== null) return resultError(member.error)
    isMember = member.data
  }
  if (!canViewLeague(league, viewer, isMember)) return NextResponse.json({ error: LEAGUE_NOT_FOUND }, { status: 404 })
  const canManage = canManageLeague(league, viewer)
  if (need === 'manage' && !canManage) return NextResponse.json({ error: MANAGE_REFUSED }, { status: 403 })
  return { league, viewer, isMember, canManage }
}
