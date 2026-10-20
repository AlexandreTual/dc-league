// Contenu de la page d'accueil : les rubriques du site et l'avancement de la saison.
import type { Messages } from './i18n/messages'
import type { NavUser } from './nav'

export type Feature = {
  key: 'ligue' | 'decks' | 'test' | 'enligne' | 'stats' | 'regles'
  title: string
  text: string
  href: string
  cta: string
  /** Réservé aux joueurs connectés : le lien passe par la connexion. */
  locked: boolean
}

/** Rubriques présentées sur l'accueil ; celles des joueurs mènent à la connexion pour un visiteur. */
export function features(user: NavUser | null, t: Messages): Feature[] {
  const player = !!user && !user.isBootstrap
  const gated = (href: string) => (player ? href : `/connexion?from=${href}`)
  const items: { key: Feature['key']; locked: boolean; href: string }[] = [
    { key: 'ligue', locked: false, href: '/ligues' },
    { key: 'decks', locked: !player, href: gated('/profil/decks') },
    { key: 'test', locked: !player, href: gated('/profil/decks') },
    { key: 'enligne', locked: !player, href: gated('/salon') },
    { key: 'stats', locked: false, href: '/ligues/statistiques' },
    { key: 'regles', locked: false, href: '/rules' },
  ]
  return items.map((item) => ({ ...item, ...t.site.features[item.key] }))
}

/** Part des matchs de la saison déjà joués, en pourcentage arrondi. */
export function seasonProgress(played: number, total: number): number {
  return total > 0 ? Math.round((played / total) * 100) : 0
}
