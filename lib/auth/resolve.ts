import { countAdmins, deleteSession, extendSession, getSessionWithUser } from '@/lib/db-auth'
import { hashToken } from './crypto'
import type { CurrentUser } from './types'

export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000
export const SESSION_EXTEND_THRESHOLD_MS = 29 * 24 * 3600 * 1000
export const BOOTSTRAP_USER_ID = 'bootstrap'

export const BOOTSTRAP_USER: CurrentUser = {
  id: BOOTSTRAP_USER_ID,
  playerId: '',
  username: 'admin',
  isAdmin: true,
  playerName: 'Admin (démarrage)',
  avatarUrl: null,
  isBootstrap: true,
}

/** Jeton du cookie → utilisateur courant, en nettoyant les sessions mortes et en prolongeant les actives. */
export async function resolveSession(db: D1Database, token: string | undefined, now: Date): Promise<CurrentUser | null> {
  if (!token) return null
  const idHash = await hashToken(token)
  const { data: session } = await getSessionWithUser(db, idHash)
  if (!session) return null

  const expiresAt = new Date(session.expires_at).getTime()
  const isBootstrap = session.user_id === BOOTSTRAP_USER_ID
  if (expiresAt <= now.getTime() || (!isBootstrap && !session.user)) {
    await deleteSession(db, idHash)
    return null
  }

  if (isBootstrap) {
    const { data: admins } = await countAdmins(db)
    if (admins !== 0) {
      await deleteSession(db, idHash)
      return null
    }
  }

  if (expiresAt - now.getTime() < SESSION_EXTEND_THRESHOLD_MS) {
    await extendSession(db, idHash, new Date(now.getTime() + SESSION_TTL_MS).toISOString())
  }

  if (isBootstrap) return BOOTSTRAP_USER
  const u = session.user!
  return {
    id: u.id,
    playerId: u.player_id,
    username: u.username,
    isAdmin: u.is_admin,
    playerName: u.player_name,
    avatarUrl: u.avatar_url,
    isBootstrap: false,
  }
}
