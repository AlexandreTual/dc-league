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

/** Absence de l'hôte au-delà de laquelle son rôle passe à un autre joueur. */
export const HOST_TIMEOUT_MS = 5 * 60_000

const MSG = {
  spectator: 'Les spectateurs ne peuvent pas jouer',
  finished: 'La partie est terminée',
  notHost: "Seul l'hôte peut faire ça",
  notTheirTurn: "Ce n'est pas son tour",
  nothingToUndo: 'Rien à annuler',
  unknown: 'Message inconnu',
}

const refused = (error: string): Outcome => ({ changed: false, error, events: [] })
const done = (events: RoomEvent[] = []): Outcome => ({ changed: true, error: null, events })

// ── Création ──────────────────────────────────────────────────────────────────

/**
 * `now` : instant de création (ou de réveil) ; un joueur pas encore connecté est absent depuis cet instant,
 * sauf date d'absence enregistrée (`saved`, conservée à travers l'hibernation).
 */
function baseRoom(
  tableId: string, setup: GameSetup, hostId: string, history: GameHistory, now: number, saved: Record<string, number> = {},
): RoomState {
  return {
    tableId,
    hostId,
    seats: setup.players.map((p) => ({ playerId: p.id, name: p.name })),
    history,
    online: {},
    absentSince: Object.fromEntries(setup.players.map((p) => [p.id, saved[p.id] ?? now])),
    finished: false,
    winner: null,
  }
}

export function createRoom(tableId: string, setup: GameSetup, hostId: string, seed: number, now: number): RoomState {
  return baseRoom(tableId, setup, hostId, new GameHistory(setup, [{ type: 'start', actor: 'server', seed }]), now)
}

export function restoreRoom(
  tableId: string,
  setup: GameSetup,
  hostId: string,
  actions: GameAction[],
  meta: { finished: boolean; winner: string | null },
  now: number,
  absentSince: Record<string, number> = {},
): RoomState {
  return { ...baseRoom(tableId, setup, hostId, new GameHistory(setup, actions), now, absentSince), ...meta }
}

// ── Messages ──────────────────────────────────────────────────────────────────

const isSeated = (room: RoomState, playerId: string | null): playerId is string =>
  playerId !== null && room.seats.some((s) => s.playerId === playerId)

/** Action complète : auteur imposé, graine tirée par le serveur quand l'action en utilise une. */
function serverAction(action: ClientAction, actor: string, seed: () => number): GameAction {
  // Champs que seul le serveur pose : auteur, graine, passage de tour par l'hôte.
  const { actor: _a, seed: _s, byHost: _h, ...rest } = action as ClientAction & { actor?: unknown; seed?: unknown; byHost?: unknown }
  const full = { ...rest, actor } as GameAction
  if (full.type === 'mulligan' || full.type === 'shuffle' || full.type === 'endLook') return { ...full, seed: seed() } as GameAction
  return full
}

/** Joue une action ; termine la partie s'il ne reste qu'un joueur en lice (à partir de 2 joueurs). */
function play(room: RoomState, action: GameAction): Outcome {
  const error = room.history.push(action)
  if (error !== null) return refused(error)
  const players = Object.values(room.history.state.players)
  const alive = players.filter((p) => !p.eliminated)
  if (players.length >= 2 && alive.length <= 1) return finish(room, alive[0]?.id ?? null)
  return done()
}

function finish(room: RoomState, winner: string | null): Outcome {
  room.finished = true
  room.winner = winner
  return done([{ type: 'finished', winner }])
}

/** Si l'hôte est absent depuis plus de 5 minutes, son rôle passe au premier joueur connecté suivant. */
function checkHost(room: RoomState, now: number): RoomEvent[] {
  const since = room.absentSince[room.hostId]
  if ((room.online[room.hostId] ?? 0) > 0 || since === undefined || now - since <= HOST_TIMEOUT_MS) return []
  const order = room.seats.map((s) => s.playerId)
  const start = order.indexOf(room.hostId)
  for (let step = 1; step < order.length; step++) {
    const next = order[(start + step) % order.length]
    if ((room.online[next] ?? 0) > 0) {
      room.hostId = next
      return [{ type: 'hostChanged', hostId: next }]
    }
  }
  return []
}

function hostCommand(room: RoomState, from: string, msg: Extract<ClientMessage, { type: 'host' }>): Outcome {
  if (from !== room.hostId) return refused(MSG.notHost)
  if (msg.op === 'close') return finish(room, null)
  if (msg.op === 'eliminate') return play(room, { type: 'eliminate', actor: from, target: msg.target })
  if (room.history.state.activePlayer !== msg.target) return refused(MSG.notTheirTurn)
  return play(room, { type: 'endTurn', actor: msg.target, byHost: true })
}

function dispatch(room: RoomState, from: string, msg: ClientMessage, ctx: RoomContext): Outcome {
  if (room.finished) return refused(MSG.finished)
  switch (msg.type) {
    case 'action':
      return play(room, serverAction(msg.action, from, ctx.seed))
    case 'undo':
      return room.history.undo(from) ? done() : refused(MSG.nothingToUndo)
    case 'concede':
      return play(room, { type: 'eliminate', actor: from, target: from })
    case 'host':
      return hostCommand(room, from, msg)
    default:
      return refused(MSG.unknown)
  }
}

export function handleMessage(room: RoomState, from: string | null, msg: ClientMessage, ctx: RoomContext): Outcome {
  if (!isSeated(room, from)) return refused(MSG.spectator)
  const hostEvents = checkHost(room, ctx.now)
  const outcome = dispatch(room, from, msg, ctx)
  if (hostEvents.length === 0) return outcome
  return { changed: true, error: outcome.error, events: [...hostEvents, ...outcome.events] }
}

// ── Présence ──────────────────────────────────────────────────────────────────

export function handleConnect(room: RoomState, playerId: string | null, now: number): Outcome {
  if (!isSeated(room, playerId)) return { changed: false, error: null, events: [] }
  room.online[playerId] = (room.online[playerId] ?? 0) + 1
  delete room.absentSince[playerId]
  return done(checkHost(room, now))
}

export function handleDisconnect(room: RoomState, playerId: string | null, now: number): Outcome {
  if (!isSeated(room, playerId) || !room.online[playerId]) return { changed: false, error: null, events: [] }
  room.online[playerId] -= 1
  if (room.online[playerId] > 0) return { changed: false, error: null, events: [] }
  room.absentSince[playerId] = now
  return done()
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
