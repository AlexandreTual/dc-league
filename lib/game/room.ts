// Logique d'une table en ligne, sans Cloudflare : messages des joueurs → effets sur la partie.
// Le runtime du Durable Object (workers/game) s'occupe des sockets, du stockage et de D1.
import { GameHistory } from './replay'
import { viewFor } from './view'
import type { CatalogEntry, GameAction, GameSetup, PlayerView } from './types'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** Action envoyée par un navigateur : l'auteur et les graines sont fixés par le serveur. */
export type ClientAction = DistributiveOmit<Exclude<GameAction, { type: 'start' }>, 'actor' | 'seed'>

export type ClientMessage =
  | { type: 'action'; action: ClientAction }
  | { type: 'undo' }
  | { type: 'concede' }
  | { type: 'host'; op: 'passTurn' | 'eliminate'; target: string }
  | { type: 'host'; op: 'close' }

/** Données de cartes : propriétaire → ref → entrée du catalogue. */
export type CardDataMap = Record<string, Record<number, CatalogEntry>>

export type ViewMessage = {
  type: 'view'
  view: PlayerView
  cards: CardDataMap
  host: string
  online: string[]
  finished: boolean
  winner: string | null
}

export type ServerMessage = ViewMessage | { type: 'rejected'; error: string }

export type RoomState = {
  tableId: string
  hostId: string
  seats: { playerId: string; name: string }[]
  history: GameHistory
  online: Record<string, number>
  absentSince: Record<string, number>
  finished: boolean
  winner: string | null
}

export type RoomEvent = { type: 'hostChanged'; hostId: string } | { type: 'finished'; winner: string | null }

export type Outcome = { changed: boolean; error: string | null; events: RoomEvent[] }

export type RoomContext = { now: number; seed: () => number }

const MSG = {
  spectator: 'Les spectateurs ne peuvent pas jouer',
  nothingToUndo: 'Rien à annuler',
  unknown: 'Message inconnu',
}

const refused = (error: string): Outcome => ({ changed: false, error, events: [] })
const done = (events: RoomEvent[] = []): Outcome => ({ changed: true, error: null, events })

// ── Création ──────────────────────────────────────────────────────────────────

function baseRoom(tableId: string, setup: GameSetup, hostId: string, history: GameHistory): RoomState {
  return {
    tableId,
    hostId,
    seats: setup.players.map((p) => ({ playerId: p.id, name: p.name })),
    history,
    online: {},
    absentSince: {},
    finished: false,
    winner: null,
  }
}

export function createRoom(tableId: string, setup: GameSetup, hostId: string, seed: number): RoomState {
  return baseRoom(tableId, setup, hostId, new GameHistory(setup, [{ type: 'start', actor: 'server', seed }]))
}

export function restoreRoom(
  tableId: string,
  setup: GameSetup,
  hostId: string,
  actions: GameAction[],
  meta: { finished: boolean; winner: string | null },
): RoomState {
  return { ...baseRoom(tableId, setup, hostId, new GameHistory(setup, actions)), ...meta }
}

// ── Messages ──────────────────────────────────────────────────────────────────

const isSeated = (room: RoomState, playerId: string | null): playerId is string =>
  playerId !== null && room.seats.some((s) => s.playerId === playerId)

/** Action complète : auteur imposé, graine tirée par le serveur quand l'action en utilise une. */
function serverAction(action: ClientAction, actor: string, seed: () => number): GameAction {
  const { actor: _a, seed: _s, ...rest } = action as ClientAction & { actor?: unknown; seed?: unknown }
  const full = { ...rest, actor } as GameAction
  if (full.type === 'mulligan' || full.type === 'shuffle' || full.type === 'endLook') return { ...full, seed: seed() } as GameAction
  return full
}

function play(room: RoomState, action: GameAction): Outcome {
  const error = room.history.push(action)
  return error === null ? done() : refused(error)
}

export function handleMessage(room: RoomState, from: string | null, msg: ClientMessage, ctx: RoomContext): Outcome {
  if (!isSeated(room, from)) return refused(MSG.spectator)

  switch (msg.type) {
    case 'action':
      return play(room, serverAction(msg.action, from, ctx.seed))
    case 'undo':
      return room.history.undo(from) ? done() : refused(MSG.nothingToUndo)
    case 'concede':
      return play(room, { type: 'eliminate', actor: from, target: from })
    default:
      return refused(MSG.unknown)
  }
}

// ── Vues ──────────────────────────────────────────────────────────────────────

export function onlinePlayers(room: RoomState): string[] {
  return room.seats.map((s) => s.playerId).filter((p) => (room.online[p] ?? 0) > 0)
}

/** Fusionne des données de cartes sans modifier les objets reçus. */
export function mergeCards(prev: CardDataMap, next: CardDataMap): CardDataMap {
  const out: CardDataMap = { ...prev }
  for (const [owner, refs] of Object.entries(next)) out[owner] = { ...prev[owner], ...refs }
  return out
}

/** Données des cartes visibles dans la vue, sauf celles déjà envoyées à ce destinataire. */
function newCardData(room: RoomState, view: PlayerView, alreadySent: CardDataMap): CardDataMap {
  const catalogs = room.history.state.catalogs
  const out: CardDataMap = {}
  const add = (owner: string, ref: number | null) => {
    if (ref === null || alreadySent[owner]?.[ref] || out[owner]?.[ref]) return
    const entry = catalogs[owner]?.entries.find((e) => e.ref === ref)
    if (entry) (out[owner] ??= {})[ref] = entry
  }
  for (const player of Object.values(view.players)) {
    const { library, ...zones } = player.zones
    for (const cards of Object.values(zones)) for (const c of cards) if (!c.hidden) add(c.owner, c.ref)
    for (const { card } of library.visible) add(card.owner, card.ref)
  }
  return out
}

/** Message de vue pour un joueur (ou un spectateur : `viewer` nul). */
export function viewMessageFor(room: RoomState, viewer: string | null, alreadySent: CardDataMap): ViewMessage {
  const me = isSeated(room, viewer) ? viewer : ''
  const view = viewFor(room.history.state, me, me !== '' && room.history.canUndo(me))
  return {
    type: 'view',
    view,
    cards: newCardData(room, view, alreadySent),
    host: room.hostId,
    online: onlinePlayers(room),
    finished: room.finished,
    winner: room.winner,
  }
}
