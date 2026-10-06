/**
 * Plateau d'un adversaire ouvert dans une fenêtre à part (partie en ligne, ordinateur).
 * La fenêtre et la table s'échangent des messages par un `BroadcastChannel` propre à la table :
 * la fenêtre annonce « ouverte » toutes les 2 s et « fermée » en partant ; la table demande « Ramener ».
 */

/** Intervalle des signaux de vie de la fenêtre. */
export const BOARD_WINDOW_HEARTBEAT_MS = 2000
/** Sans signal pendant ce délai (onglet tué, plantage), le plateau revient sur la table. */
export const BOARD_WINDOW_TIMEOUT_MS = 5000

export type BoardWindowMessage =
  /** Fenêtre ouverte (au chargement, puis à chaque signal de vie). */
  | { type: 'open'; player: string }
  /** Fenêtre qui se ferme. */
  | { type: 'closed'; player: string }
  /** Demande de la table : fermer la fenêtre de ce joueur et remettre son plateau. */
  | { type: 'return'; player: string }
  /** Table (re)chargée : les fenêtres ouvertes se signalent sans attendre. */
  | { type: 'hello' }

export const channelName = (tableId: string) => `dc-table-${tableId}`
export const boardWindowUrl = (tableId: string, player: string) =>
  `/tables/${encodeURIComponent(tableId)}/plateau/${encodeURIComponent(player)}`
/** Nom de la fenêtre : recliquer remet au premier plan la fenêtre déjà ouverte au lieu d'en ouvrir une autre. */
export const boardWindowName = (player: string) => `plateau-${player}`

export function isBoardWindowMessage(x: unknown): x is BoardWindowMessage {
  if (typeof x !== 'object' || x === null) return false
  const m = x as { type?: unknown; player?: unknown }
  if (m.type === 'hello') return true
  return (m.type === 'open' || m.type === 'closed' || m.type === 'return') && typeof m.player === 'string'
}

/** Dernier signal reçu de chaque fenêtre ouverte, par joueur. */
export type DetachedState = Record<string, number>

export function receive(state: DetachedState, msg: BoardWindowMessage, now: number): DetachedState {
  if (msg.type === 'hello') return state
  if (msg.type === 'open') return { ...state, [msg.player]: now }
  if (!(msg.player in state)) return state
  const { [msg.player]: _, ...rest } = state
  return rest
}

/** Joueurs dont le plateau est dans une fenêtre encore vivante. */
export function detachedPlayers(state: DetachedState, now: number): string[] {
  return Object.keys(state).filter((p) => now - state[p] < BOARD_WINDOW_TIMEOUT_MS)
}
