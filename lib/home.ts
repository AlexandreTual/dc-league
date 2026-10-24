// Contenu de la page d'accueil : les rubriques du site, l'avancement de la saison et le bloc « À toi de jouer ».
import type { Messages } from './i18n/messages'
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
