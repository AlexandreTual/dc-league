// Contenu de la page d'accueil : les rubriques du site et l'avancement de la saison.
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
export function features(user: NavUser | null): Feature[] {
  const player = !!user && !user.isBootstrap
  const gated = (href: string) => (player ? href : `/connexion?from=${href}`)
  return [
    {
      key: 'ligue', locked: false, href: '/ligues', cta: 'Voir les ligues',
      title: 'Les ligues',
      text: 'Crée ta ligue entre amis, publique ou privée, et invite tes joueurs par un lien. En Duel Commander : tout le monde affronte tout le monde, puis les 4 premiers jouent la phase finale.',
    },
    {
      key: 'decks', locked: !player, href: gated('/profil/decks'), cta: 'Mes decks',
      title: 'Tes decks',
      text: 'Importe un deck depuis Moxfield, Archidekt ou une liste copiée. Cartes en français, jetons du deck, texte Oracle et règles de chaque carte.',
    },
    {
      key: 'test', locked: !player, href: gated('/profil/decks'), cta: 'Choisir un deck à tester',
      title: 'Le mode test',
      text: 'Joue seul avec ton deck pour tester tes mains de départ, ta courbe et tes combos, avec la même table que les parties en ligne.',
    },
    {
      key: 'enligne', locked: !player, href: gated('/salon'), cta: 'Ouvrir le salon',
      title: 'Les parties en ligne',
      text: 'Ouvre une table au salon et joue de 2 à 5 joueurs, en Commander ou en Duel Commander : points de vie, blessures de commandant, jetons, dés.',
    },
    {
      key: 'stats', locked: false, href: '/ligues/statistiques', cta: 'Voir les statistiques',
      title: 'Statistiques et historique',
      text: 'Palmarès de toutes les ligues publiques, face-à-face entre joueurs et résultats des ligues terminées.',
    },
    {
      key: 'regles', locked: false, href: '/rules', cta: 'Lire les règles',
      title: 'Les règles',
      text: 'Format, déroulement des matchs en BO3, proxys autorisés et inscription des decks.',
    },
  ]
}

/** Part des matchs de la saison déjà joués, en pourcentage arrondi. */
export function seasonProgress(played: number, total: number): number {
  return total > 0 ? Math.round((played / total) * 100) : 0
}
