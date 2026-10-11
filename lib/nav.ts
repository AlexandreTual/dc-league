// Navigation du site : quels liens montrer, à qui, et quand les allumer.
// Pur (sans React) pour être testé ; les icônes sont choisies par les composants.

export type NavUser = { isAdmin: boolean; isBootstrap: boolean }
export type NavLink = { href: string; label: string }

/** Pages regroupées sous « Ligue » (onglets en haut de chacune). */
const LEAGUE_PAGES = ['/classement', '/calendar', '/playoffs', '/stats', '/history']

/** Pages rattachées à un lien de la barre en plus du lien lui-même. */
const SECTIONS: Record<string, string[]> = {
  '/classement': LEAGUE_PAGES,
  '/salon': ['/salon', '/tables'],
  '/profil/decks': ['/profil/decks', '/decks'],
}

/** Barre du haut : la ligue et les règles pour tous ; le salon et ses decks une fois connecté. L'admin passe par le menu du compte. */
export function mainLinks(user: NavUser | null): NavLink[] {
  const player = user && !user.isBootstrap
  return [
    { href: '/classement', label: 'Ligue' },
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

/** Onglets de la ligue ; « Playoffs » n'apparaît qu'une fois la phase finale lancée. */
export function leagueTabs({ hasPlayoffs }: { hasPlayoffs: boolean }): NavLink[] {
  return [
    { href: '/classement', label: 'Classement' },
    { href: '/calendar', label: 'Calendrier' },
    ...(hasPlayoffs ? [{ href: '/playoffs', label: 'Playoffs' }] : []),
    { href: '/stats', label: 'Statistiques' },
    { href: '/history', label: 'Historique' },
  ]
}

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/** Vrai si le lien doit être allumé : pour la barre, toute sa section ; pour un onglet, sa page et ses sous-pages. */
export function isActive(href: string, pathname: string, kind: 'bar' | 'tab' = 'bar'): boolean {
  if (kind === 'tab') return within(pathname, href)
  return (SECTIONS[href] ?? [href]).some((base) => within(pathname, base))
}
