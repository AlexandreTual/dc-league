// Droits sur une ligue : qui la voit, qui la gère. Pur, pour être testé et partagé par pages et routes.
import type { CurrentUser } from '@/lib/auth/types'

/** Personne qui consulte : null pour un visiteur non connecté. */
export type Viewer = { playerId: string; isAdmin: boolean } | null

type Visible = { visibility: 'public' | 'private'; owner_player_id: string | null }
type Owned = { owner_player_id: string | null }

/** La session de démarrage a les droits d'admin, comme dans les routes API. */
export function viewerOf(user: CurrentUser | null): Viewer {
  return user ? { playerId: user.playerId, isAdmin: user.isAdmin || user.isBootstrap } : null
}

/** Admin, ou organisateur de la ligue. Une ligue sans organisateur n'est gérée que par les admins. */
export function canManageLeague(league: Owned, viewer: Viewer): boolean {
  if (!viewer) return false
  return viewer.isAdmin || (!!league.owner_player_id && league.owner_player_id === viewer.playerId)
}

/** Publique : tout le monde. Privée : inscrits, organisateur et admins. */
export function canViewLeague(league: Visible, viewer: Viewer, isMember: boolean): boolean {
  return league.visibility === 'public' || isMember || canManageLeague(league, viewer)
}
