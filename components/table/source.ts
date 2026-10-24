import type { LocalClock } from '@/lib/game/clock'
import type { CardDataMap, ClientAction, RtcServerMessage } from '@/lib/game/room'
import type { Catalog, DeckToken, PlayerView } from '@/lib/game/types'

/** Ce que la table consomme, qu'elle soit locale (mode test) ou en ligne. */
export type GameSource = {
  /** Mon identifiant de joueur ; null pour un spectateur. */
  me: string | null
  view: PlayerView
  /** Données de cartes connues, par propriétaire. */
  catalogs: Record<string, Catalog>
  send(action: ClientAction): void
  undo(): void
  canUndo: boolean
  /** Dernier refus (moteur ou serveur), effacé après quelques secondes. */
  error: string | null
  mode: 'local' | 'online'
  online?: {
    /** Table en ligne (fenêtres à part du plateau d'un adversaire). */
    tableId: string
    status: 'connecting' | 'open' | 'reconnecting' | 'closed'
    host: string
    players: string[]
    finished: boolean
    winner: string | null
    /** Minuteur à l'heure locale ; absent avec un serveur de jeu plus ancien (rien n'est affiché). */
    clock?: LocalClock
    concede(): void
    hostCommands?: { passTurn(target: string): void; eliminate(target: string): void; close(): void }
    /** Visio : signalisation par le serveur de jeu ; absente avec un serveur plus ancien (pas de bouton). */
    visio?: VisioChannel
  }
  local?: { deckId: string; deckName: string; newGame(): void }
  /** Jetons de mon deck, pour « Créer un jeton » ; absents tant qu'ils ne sont pas chargés. */
  deckTokens?: DeckToken[]
}

/** Canal de signalisation de la visio. `send` sans destinataire : tous les autres joueurs. */
export type VisioChannel = {
  send(to: string | undefined, data: Record<string, unknown>): void
  subscribe(listener: (message: RtcServerMessage) => void): () => void
}

/** Catalogues reconstitués à partir des données de cartes reçues du serveur. */
export function catalogsFrom(cards: CardDataMap): Record<string, Catalog> {
  return Object.fromEntries(
    Object.entries(cards).map(([owner, refs]) => [owner, { deckId: owner, fingerprint: '', entries: Object.values(refs) }]),
  )
}

export const ERROR_VISIBLE_MS = 4000

/**
 * La table accepte mes gestes : joueur assis et encore en jeu, partie en cours, connexion ouverte.
 * Un éliminé (ou un spectateur) regarde en lecture seule : le moteur refuserait tout de lui.
 * `eliminated` absent (serveur de jeu plus ancien) : le joueur est traité comme en jeu.
 */
export function canAct(source: Pick<GameSource, 'me' | 'view'> & { online?: Pick<NonNullable<GameSource['online']>, 'status' | 'finished'> }): boolean {
  const { me, view, online } = source
  if (me === null || online?.finished || (online && online.status !== 'open')) return false
  return !view.players[me]?.eliminated
}
