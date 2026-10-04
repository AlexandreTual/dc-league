import { shuffle } from './random'
import {
  COMMANDER_TAX_STEP,
  OPENING_HAND,
  ZONES,
  type CardFace,
  type CardInstance,
  type Catalog,
  type GameAction,
  type GameState,
  type Position,
  type ZoneId,
} from './types'

const ZONE_LABELS: Record<ZoneId, string> = {
  library: 'bibliothèque',
  hand: 'main',
  battlefield: 'champ de bataille',
  graveyard: 'cimetière',
  exile: 'exil',
  command: 'zone de commandement',
}

const NO_COUNTERS = { plus: 0, minus: 0, other: 0 }
const clampPct = (v: number) => Math.min(100, Math.max(0, v))
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

// ── Lecture ───────────────────────────────────────────────────────────────────

function entryOf(catalog: Catalog, card: CardInstance) {
  return card.ref === null ? undefined : catalog.entries.find((e) => e.ref === card.ref)
}

export function zoneOf(state: GameState, id: string): ZoneId | null {
  return ZONES.find((z) => state.zones[z].includes(id)) ?? null
}

/** Nom pour le journal : nom français s'il existe, sinon anglais. */
export function cardName(state: GameState, catalog: Catalog, id: string): string {
  const card = state.cards[id]
  if (!card) return 'une carte'
  if (card.token) return card.token.name
  const entry = entryOf(catalog, card)
  return entry?.fr?.printed_name ?? entry?.en.name ?? 'une carte'
}

export function isLand(state: GameState, catalog: Catalog, id: string): boolean {
  const card = state.cards[id]
  if (!card) return false
  const typeLine = card.token?.typeLine ?? entryOf(catalog, card)?.en.type_line ?? ''
  return typeLine.split(' // ')[0].includes('Land')
}

export function bottomCount(state: GameState): number {
  return Math.max(0, state.stats.mulligans - 1)
}

export function taxOf(state: GameState, id: string): number {
  return COMMANDER_TAX_STEP * (state.commanderCasts[id] ?? 0)
}

export function cardData(
  state: GameState,
  catalog: Catalog,
  id: string,
  lang: 'fr' | 'en',
): { name: string; image: string | null; typeLine: string; faces: CardFace[] | null; hidden: boolean } {
  const card = state.cards[id]
  if (card?.token) {
    return { name: card.token.name, image: card.token.image, typeLine: card.token.typeLine, faces: null, hidden: false }
  }
  const entry = card ? entryOf(catalog, card) : undefined
  const shown = (lang === 'fr' ? entry?.fr : null) ?? entry?.en
  if (!card || !shown) return { name: 'une carte', image: null, typeLine: '', faces: null, hidden: true }
  const faces = shown.faces
  const face = card.flipped && faces && faces.length > 1 ? faces[1] : null
  const name = face ? (face.printed_name ?? face.name) : (shown.printed_name ?? shown.name)
  return {
    name,
    image: face?.image_normal ?? shown.image_normal,
    typeLine: face?.type_line ?? shown.type_line,
    faces,
    hidden: card.faceDown,
  }
}

// ── Écriture (toujours sur des copies) ────────────────────────────────────────

function withLog(state: GameState, text: string): GameState {
  return { ...state, log: [...state.log, { turn: state.turn, text }] }
}

function setCard(state: GameState, id: string, patch: Partial<CardInstance>): GameState {
  return { ...state, cards: { ...state.cards, [id]: { ...state.cards[id], ...patch } } }
}

function setZone(state: GameState, zone: ZoneId, ids: string[]): GameState {
  return { ...state, zones: { ...state.zones, [zone]: ids } }
}

function insertAt(list: string[], id: string, position: Position): string[] {
  if (position === 'top') return [id, ...list]
  if (position === 'bottom') return [...list, id]
  const index = Math.max(0, Math.min(list.length, Math.floor(position)))
  return [...list.slice(0, index), id, ...list.slice(index)]
}

function draw(state: GameState, count: number): GameState {
  const n = Math.min(Math.max(0, count), state.zones.library.length)
  const drawn = state.zones.library.slice(0, n)
  return {
    ...state,
    zones: { ...state.zones, library: state.zones.library.slice(n), hand: [...state.zones.hand, ...drawn] },
    stats: { ...state.stats, drawn: state.stats.drawn + n },
  }
}

function shuffleLibrary(state: GameState, seed: number): GameState {
  return setZone(state, 'library', shuffle(state.zones.library, seed))
}

function untapAll(state: GameState): GameState {
  const cards = { ...state.cards }
  for (const id of state.zones.battlefield) cards[id] = { ...cards[id], tapped: false }
  return { ...state, cards }
}

function move(state: GameState, catalog: Catalog, action: Extract<GameAction, { type: 'move' }>): GameState {
  const card = state.cards[action.id]
  const from = zoneOf(state, action.id)
  if (!card || !from) return state
  const { to } = action
  const hidden = card.faceDown || to === 'library' || (from === 'library' && to === 'hand')
  const name = hidden ? 'une carte' : cardName(state, catalog, action.id)

  // Repositionnement sur le champ de bataille : pas de journal.
  if (from === 'battlefield' && to === 'battlefield') {
    return setCard(state, action.id, { x: clampPct(action.x ?? card.x), y: clampPct(action.y ?? card.y) })
  }

  let next = setZone(state, from, state.zones[from].filter((id) => id !== action.id))

  // Un jeton qui quitte le champ de bataille cesse d'exister.
  if (card.token && to !== 'battlefield') {
    const cards = { ...next.cards }
    delete cards[action.id]
    return withLog({ ...next, cards }, `${name} : ${ZONE_LABELS[from]} → ${ZONE_LABELS[to]} (disparaît)`)
  }

  const position: Position = action.position ?? (to === 'library' ? 'top' : 'bottom')
  next = setZone(next, to, insertAt(next.zones[to], action.id, position))

  const patch: Partial<CardInstance> = {}
  if (to === 'battlefield') {
    patch.x = clampPct(action.x ?? 50)
    patch.y = clampPct(action.y ?? 50)
  }
  if (from === 'battlefield') {
    Object.assign(patch, { tapped: false, flipped: false, faceDown: false, counters: NO_COUNTERS })
  }
  next = setCard(next, action.id, patch)

  if (card.isCommander && from === 'command' && to !== 'command') {
    next = { ...next, commanderCasts: { ...next.commanderCasts, [action.id]: (next.commanderCasts[action.id] ?? 0) + 1 } }
  }
  if (from === 'hand' && to === 'battlefield' && isLand(state, catalog, action.id)) {
    next = { ...next, stats: { ...next.stats, landsPlayed: next.stats.landsPlayed + 1 } }
  }

  const where = to === 'library' ? ` (${position === 'bottom' ? 'dessous' : position === 'top' ? 'dessus' : `position ${position}`})` : ''
  return withLog(next, `${name} : ${ZONE_LABELS[from]} → ${ZONE_LABELS[to]}${where}`)
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

export function applyAction(state: GameState, action: GameAction, catalog: Catalog): GameState {
  switch (action.type) {
    case 'start':
      return withLog(draw(shuffleLibrary(state, action.seed), OPENING_HAND), 'Début de partie')

    case 'shuffle':
      return withLog(shuffleLibrary(state, action.seed), 'Mélange la bibliothèque')

    case 'draw': {
      if (state.zones.library.length === 0) return withLog(state, 'Bibliothèque vide')
      const n = Math.min(action.count, state.zones.library.length)
      return withLog(draw(state, n), `Pioche ${plural(n, 'carte')}`)
    }

    case 'mulligan': {
      const back = { ...state, zones: { ...state.zones, library: [...state.zones.library, ...state.zones.hand], hand: [] } }
      const drawn = draw(shuffleLibrary(back, action.seed), OPENING_HAND)
      const next = { ...drawn, stats: { ...drawn.stats, mulligans: state.stats.mulligans + 1 } }
      const k = bottomCount(next)
      const n = next.stats.mulligans
      return withLog(next, k === 0 ? `Mulligan n°${n} (gratuit)` : `Mulligan n°${n} : mets ${k} carte(s) en dessous`)
    }

    case 'move':
      return move(state, catalog, action)

    case 'tap': {
      if (!state.zones.battlefield.includes(action.id)) return state
      return setCard(state, action.id, { tapped: !state.cards[action.id].tapped })
    }

    case 'untapAll':
      return untapAll(state)

    case 'life': {
      const life = state.life + action.delta
      return withLog({ ...state, life }, `Points de vie : ${state.life} → ${life}`)
    }

    case 'nextTurn': {
      const next = draw(untapAll({ ...state, turn: state.turn + 1 }), 1)
      return withLog(next, `Tour ${next.turn}`)
    }

    default:
      return state
  }
}
