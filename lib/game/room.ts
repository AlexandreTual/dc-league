// Logique d'une table en ligne, sans Cloudflare : messages des joueurs → effets sur la partie.
// Le runtime du Durable Object (workers/game) s'occupe des sockets, du stockage et de D1.
import { startAction } from './random'
import { GameHistory } from './replay'
import { viewFor } from './view'
import type { CatalogEntry, GameAction, GameSetup, PlayerView, Seed } from './types'
import { parseClientAction } from './validate'

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** Action envoyée par un navigateur : l'auteur et les graines sont fixés par le serveur. */
export type ClientAction = DistributiveOmit<Exclude<GameAction, { type: 'start' }>, 'actor' | 'seed' | 'at'>

export type ClientMessage =
  | { type: 'action'; action: ClientAction }
  | { type: 'undo' }
  | { type: 'concede' }
  | { type: 'host'; op: 'passTurn' | 'eliminate'; target: string }
  | { type: 'host'; op: 'close' }

/** Données de cartes : propriétaire → ref → entrée du catalogue. */
export type CardDataMap = Record<string, Record<number, CatalogEntry>>

/**
 * Minuteur, en millisecondes du serveur : `now` sert au navigateur à corriger l'écart avec sa propre horloge.
 * Absent avec un serveur de jeu plus ancien ou pour une partie commencée avant l'horodatage.
 */
export type GameClock = { now: number; startedAt?: number; turnStartedAt?: number; finishedAt?: number }

export type ViewMessage = {
  type: 'view'
  view: PlayerView
  cards: CardDataMap
  host: string
  online: string[]
  finished: boolean
  winner: string | null
  clock?: GameClock
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
  /** Instant de fin (ms) ; absent pour une partie finie avant l'horodatage. */
  finishedAt?: number
}

export type RoomEvent = { type: 'hostChanged'; hostId: string } | { type: 'finished'; winner: string | null }

export type Outcome = { changed: boolean; error: string | null; events: RoomEvent[] }

export type RoomContext = { now: number; seed: () => Seed }

/** Absence de l'hôte au-delà de laquelle son rôle passe à un autre joueur. */
export const HOST_TIMEOUT_MS = 5 * 60_000

const MSG = {
  spectator: 'Les spectateurs ne peuvent pas jouer',
  finished: 'La partie est terminée',
  notHost: "Seul l'hôte peut faire ça",
  notTheirTurn: "Ce n'est pas son tour",
  nothingToUndo: 'Rien à annuler',
  eliminateOther: 'Seul l’hôte peut éliminer un autre joueur',
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

export function createRoom(tableId: string, setup: GameSetup, hostId: string, seed: () => Seed, now: number): RoomState {
  const start = { ...startAction(setup.players.map((p) => p.id), seed), at: now }
  return baseRoom(tableId, setup, hostId, new GameHistory(setup, [start]), now)
}

export function restoreRoom(
  tableId: string,
  setup: GameSetup,
  hostId: string,
  actions: GameAction[],
  meta: { finished: boolean; winner: string | null; finishedAt?: number },
  now: number,
  absentSince: Record<string, number> = {},
): RoomState {
  const { finished, winner, finishedAt } = meta
  const room = { ...baseRoom(tableId, setup, hostId, new GameHistory(setup, actions), now, absentSince), finished, winner }
  return finishedAt === undefined ? room : { ...room, finishedAt }
}

// ── Messages ──────────────────────────────────────────────────────────────────

const isSeated = (room: RoomState, playerId: string | null): playerId is string =>
  playerId !== null && room.seats.some((s) => s.playerId === playerId)

/**
 * Action complète, ou message de refus : action validée champ par champ (rien de ce que pose le serveur
 * n'est repris : auteur, graine, passage de tour par l'hôte), auteur imposé, graine tirée par le serveur.
 */
function serverAction(raw: unknown, actor: string, seed: () => Seed): GameAction | string {
  const action = parseClientAction(raw)
  if (typeof action === 'string') return action
  // Éliminer un autre joueur passe par la commande de l'hôte ; un joueur ne peut que concéder.
  if (action.type === 'eliminate' && action.target !== actor) return MSG.eliminateOther
  const full = { ...action, actor } as GameAction
  if (full.type === 'mulligan' || full.type === 'shuffle' || full.type === 'endLook') return { ...full, seed: seed() } as GameAction
  return full
}

/** Actions qui peuvent changer de tour : horodatées pour le minuteur. */
const STAMPED = new Set<GameAction['type']>(['endTurn', 'eliminate'])

/** Joue une action ; termine la partie s'il ne reste qu'un joueur en lice (à partir de 2 joueurs). */
function play(room: RoomState, action: GameAction, now: number): Outcome {
  const error = room.history.push(STAMPED.has(action.type) ? { ...action, at: now } : action)
  if (error !== null) return refused(error)
  const players = Object.values(room.history.state.players)
  const alive = players.filter((p) => !p.eliminated)
  if (players.length >= 2 && alive.length <= 1) return finish(room, alive[0]?.id ?? null, now)
  return done()
}

function finish(room: RoomState, winner: string | null, now: number): Outcome {
  room.finished = true
  room.winner = winner
  room.finishedAt = now
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

function hostCommand(room: RoomState, from: string, msg: Extract<ClientMessage, { type: 'host' }>, now: number): Outcome {
  if (from !== room.hostId) return refused(MSG.notHost)
  if (msg.op === 'close') return finish(room, null, now)
  if (msg.op === 'eliminate') return play(room, { type: 'eliminate', actor: from, target: msg.target }, now)
  if (room.history.state.activePlayer !== msg.target) return refused(MSG.notTheirTurn)
  return play(room, { type: 'endTurn', actor: msg.target, byHost: true }, now)
}

function dispatch(room: RoomState, from: string, msg: ClientMessage, ctx: RoomContext): Outcome {
  if (room.finished) return refused(MSG.finished)
  switch (msg.type) {
    case 'action': {
      const action = serverAction(msg.action, from, ctx.seed)
      return typeof action === 'string' ? refused(action) : play(room, action, ctx.now)
    }
    case 'undo':
      return room.history.undo(from) ? done() : refused(MSG.nothingToUndo)
    case 'concede':
      return play(room, { type: 'eliminate', actor: from, target: from }, ctx.now)
    case 'host':
      return hostCommand(room, from, msg, ctx.now)
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

// ── Minuteur ──────────────────────────────────────────────────────────────────

/** Minuteur de la partie à l'instant `now`, ou rien si aucune action n'est horodatée. */
export function gameClock(room: RoomState, now: number): GameClock | undefined {
  const { startedAt, turnStartedAt } = room.history.state
  if (startedAt === undefined && turnStartedAt === undefined) return undefined
  const clock: GameClock = { now }
  if (startedAt !== undefined) clock.startedAt = startedAt
  if (turnStartedAt !== undefined && !room.finished) clock.turnStartedAt = turnStartedAt
  if (room.finishedAt !== undefined) clock.finishedAt = room.finishedAt
  return clock
}

/**
 * Bilan d'une partie finie, en secondes : durée totale et temps de jeu de chaque joueur (tour en cours compris
 * jusqu'à la fin). `duration` nul si le début n'est pas horodaté ; `playTime` vide si aucun tour ne l'est.
 */
export function gameTiming(room: RoomState): { duration: number | null; playTime: Record<string, number> } {
  const { startedAt, turnStartedAt, activePlayer, playTime = {} } = room.history.state
  const end = room.finishedAt
  if (end === undefined) return { duration: null, playTime: {} }
  const ms = { ...playTime }
  if (turnStartedAt !== undefined) ms[activePlayer] = (ms[activePlayer] ?? 0) + Math.max(0, end - turnStartedAt)
  const seconds = (n: number) => Math.round(n / 1000)
  return {
    duration: startedAt === undefined ? null : seconds(Math.max(0, end - startedAt)),
    playTime: Object.fromEntries(Object.entries(ms).map(([p, n]) => [p, seconds(n)])),
  }
}

/** Message de vue pour un joueur (ou un spectateur : `viewer` nul). */
export function viewMessageFor(room: RoomState, viewer: string | null, alreadySent: CardDataMap, now: number): ViewMessage {
  const me = isSeated(room, viewer) ? viewer : ''
  const view = viewFor(room.history.state, me, me !== '' && room.history.canUndo(me))
  const clock = gameClock(room, now)
  return {
    type: 'view',
    view,
    cards: newCardData(room, view, alreadySent),
    host: room.hostId,
    online: onlinePlayers(room),
    finished: room.finished,
    winner: room.winner,
    ...(clock ? { clock } : {}),
  }
}
