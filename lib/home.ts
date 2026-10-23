// Contenu de la page d'accueil : les rubriques du site, l'avancement de la saison et le bloc « À toi de jouer ».
import type { NavUser } from './nav'
import type { DbMatch } from './db'
import type { GameTable } from './db-games'

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

const FORMAT_LABELS = { commander: 'Commander', duel: 'Duel Commander' } as const

export type MyTable = {
  id: string
  /** « Reprendre » une partie en cours, « Retourner à la table » ouverte, comme au salon. */
  action: 'Reprendre' | 'Retourner à la table'
  format: string
  /** Noms des autres joueurs assis. */
  others: string[]
  seated: number
  seats: number
}

/** Tables du salon où je suis assis : parties en cours d'abord, puis tables ouvertes. */
export function myTables(tables: GameTable[], me: string): MyTable[] {
  const mine = tables.filter((t) => t.players.some((p) => p.playerId === me))
  return [...mine.filter((t) => t.status === 'playing'), ...mine.filter((t) => t.status === 'open')].map((t) => ({
    id: t.id,
    action: t.status === 'playing' ? 'Reprendre' : 'Retourner à la table',
    format: FORMAT_LABELS[t.format],
    others: t.players.filter((p) => p.playerId !== me).map((p) => p.name),
    seated: t.players.length,
    seats: t.seats,
  }))
}

export type PendingMatch = { id: string; leagueId: string; leagueName: string; round: number; opponent: string }

type MatchLike = Pick<DbMatch, 'id' | 'player1_id' | 'player2_id' | 'round_number' | 'is_completed'>

/** Mes matchs de ligue pas encore joués, par journée, avec le nom de l'adversaire. */
export function myPendingMatches(
  league: { id: string; name: string },
  matches: MatchLike[],
  me: string,
  names: Map<string, string>,
): PendingMatch[] {
  return matches
    .filter((m) => !m.is_completed && (m.player1_id === me || m.player2_id === me))
    .sort((a, b) => a.round_number - b.round_number)
    .map((m) => {
      const opponentId = m.player1_id === me ? m.player2_id : m.player1_id
      return { id: m.id, leagueId: league.id, leagueName: league.name, round: m.round_number, opponent: names.get(opponentId) ?? 'Joueur inconnu' }
    })
}

/** Ma place dans un classement (du premier au dernier) ; null si je n'y suis pas inscrit. */
export function myLeagueRank(standings: { id: string; points: number }[], me: string): { rank: number; of: number; points: number } | null {
  const i = standings.findIndex((s) => s.id === me)
  return i < 0 ? null : { rank: i + 1, of: standings.length, points: standings[i].points }
}
