// Navigation du site : quels liens montrer, à qui, et quand les allumer.
// Pur (sans React) pour être testé ; les icônes sont choisies par les composants, les libellés viennent du dictionnaire.
import type { Messages } from './i18n/messages'

export type NavUser = { isAdmin: boolean; isBootstrap: boolean }
export type NavLink = { href: string; label: string }

/** Pages rattachées à un lien de la barre en plus du lien lui-même. */
const SECTIONS: Record<string, string[]> = {
  '/ligues': ['/ligues'],
  '/salon': ['/salon', '/tables'],
  '/profil/decks': ['/profil/decks', '/decks'],
}

/** Barre du haut : la ligue et les règles pour tous ; le salon et ses decks une fois connecté. L'admin passe par le menu du compte. */
export function mainLinks(user: NavUser | null, t: Messages): NavLink[] {
  const player = user && !user.isBootstrap
  return [
    { href: '/ligues', label: t.nav.league },
    ...(player ? [{ href: '/salon', label: t.nav.play }, { href: '/profil/decks', label: t.nav.myDecks }] : []),
    { href: '/rules', label: t.nav.rules },
  ]
}

/** Menu du compte : le profil (sauf compte de démarrage) et l'administration pour les admins. */
export function accountLinks(user: NavUser, t: Messages): NavLink[] {
  return [
    ...(user.isBootstrap ? [] : [{ href: '/profil', label: t.nav.profile }]),
    ...(user.isAdmin ? [{ href: '/admin', label: t.nav.admin }] : []),
  ]
}

/** Onglets d'une ligue ; « Playoffs » une fois la phase finale lancée, « Gérer » pour l'organisateur et les admins. */
export function leagueTabs({ leagueId, hasPlayoffs, canManage }: { leagueId: string; hasPlayoffs: boolean; canManage: boolean }, t: Messages): NavLink[] {
  const base = `/ligues/${leagueId}`
  return [
    { href: `${base}/classement`, label: t.nav.tabs.standings },
    { href: `${base}/calendrier`, label: t.nav.tabs.schedule },
    ...(hasPlayoffs ? [{ href: `${base}/playoffs`, label: t.nav.tabs.playoffs }] : []),
    ...(canManage ? [{ href: `${base}/gerer`, label: t.nav.tabs.manage }] : []),
  ]
}

const within = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

/** Vrai si le lien doit être allumé : pour la barre, toute sa section ; pour un onglet, sa page et ses sous-pages. */
export function isActive(href: string, pathname: string, kind: 'bar' | 'tab' = 'bar'): boolean {
  if (kind === 'tab') return within(pathname, href)
  return (SECTIONS[href] ?? [href]).some((base) => within(pathname, base))
}
