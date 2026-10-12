// Navigation du site : quels liens montrer, à qui, et quand les allumer.
// Pur (sans React) pour être testé ; les icônes sont choisies par les composants.

export type NavUser = { isAdmin: boolean; isBootstrap: boolean }
export type NavLink = { href: string; label: string }

/** Pages rattachées à un lien de la barre en plus du lien lui-même. */
const SECTIONS: Record<string, string[]> = {
  '/ligues': ['/ligues'],
  '/salon': ['/salon', '/tables'],
  '/profil/decks': ['/profil/decks', '/decks'],
}

/** Barre du haut : la ligue et les règles pour tous ; le salon et ses decks une fois connecté. L'admin passe par le menu du compte. */
export function mainLinks(user: NavUser | null): NavLink[] {
  const player = user && !user.isBootstrap
  return [
    { href: '/ligues', label: 'Ligue' },
    ...(player ? [{ href: '/salon', label: 'Jouer' }, { href: '/profil/decks', label: 'Mes decks' }] : []),
    { href: '/rules', label: 'Règles' },
  ]
}

/** Menu du compte : le profil (sauf compte de démarrage) et l'administration pour les admins. */
export function accountLinks(user: NavUser): NavLink[] {
  return [
    ...(user.isBootstrap ? [] : [{ href: '/profil', label: 'Mon profil' }]),
    ...(user.isAdmin ? [{ href: '/admin', label: 'Administration' }] : []),
  ]
}

/** Onglets d'une ligue ; « Playoffs » une fois la phase finale lancée, « Gérer » pour l'organisateur et les admins. */
export function leagueTabs({ leagueId, hasPlayoffs, canManage }: { leagueId: string; hasPlayoffs: boolean; canManage: boolean }): NavLink[] {
  const base = `/ligues/${leagueId}`
  return [
    { href: `${base}/classement`, label: 'Classement' },
    { href: `${base}/calendrier`, label: 'Calendrier' },
    ...(hasPlayoffs ? [{ href: `${base}/playoffs`, label: 'Playoffs' }] : []),
    ...(canManage ? [{ href: `${base}/gerer`, label: 'Gérer' }] : []),
  ]
}

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/** Vrai si le lien doit être allumé : pour la barre, toute sa section ; pour un onglet, sa page et ses sous-pages. */
export function isActive(href: string, pathname: string, kind: 'bar' | 'tab' = 'bar'): boolean {
  if (kind === 'tab') return within(pathname, href)
  return (SECTIONS[href] ?? [href]).some((base) => within(pathname, base))
}
