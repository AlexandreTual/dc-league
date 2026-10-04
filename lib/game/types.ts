import type { CardFace, CardRow } from '@/lib/cards/types'

export const STARTING_LIFE = 40
export const OPENING_HAND = 7
export const SNAPSHOT_EVERY = 20
export const COMMANDER_TAX_STEP = 2

export type ZoneId = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command'
export const ZONES: ZoneId[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command']

export type CatalogEntry = { ref: number; en: CardRow; fr: CardRow | null; quantity: number; isCommander: boolean }
export type Catalog = { deckId: string; fingerprint: string; entries: CatalogEntry[] }

export type TokenData = {
  name: string
  typeLine: string
  power: string | null
  toughness: string | null
  colors: string[]
  image: string | null
}

export type Counters = { plus: number; minus: number; other: number }

export type CardInstance = {
  id: string
  ref: number | null
  token: TokenData | null
  isCommander: boolean
  tapped: boolean
  flipped: boolean
  faceDown: boolean
  counters: Counters
  x: number
  y: number
}

export type LogEntry = { turn: number; text: string }

export type GameState = {
  turn: number
  life: number
  zones: Record<ZoneId, string[]>
  cards: Record<string, CardInstance>
  commanderCasts: Record<string, number>
  stats: { drawn: number; landsPlayed: number; mulligans: number }
  nextTokenId: number
  log: LogEntry[]
}

export type Position = 'top' | 'bottom' | number

export type GameAction =
  | { type: 'start'; seed: number }
  | { type: 'shuffle'; seed: number }
  | { type: 'draw'; count: number }
  | { type: 'mulligan'; seed: number }
  | { type: 'move'; id: string; to: ZoneId; position?: Position; x?: number; y?: number }
  | { type: 'tap'; id: string }
  | { type: 'untapAll' }
  | { type: 'flip'; id: string }
  | { type: 'faceDown'; id: string }
  | { type: 'counter'; id: string; kind: keyof Counters; delta: number }
  | { type: 'createToken'; token: TokenData; x: number; y: number }
  | { type: 'life'; delta: number }
  | { type: 'commanderTax'; id: string; delta: number }
  | { type: 'nextTurn' }
  | { type: 'reveal' }

export type { CardFace }
