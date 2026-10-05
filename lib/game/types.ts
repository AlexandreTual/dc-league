import type { CardFace, CardRow } from '@/lib/cards/types'

export type { CardFace }

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

export type Format = 'commander' | 'duel'

export const FORMAT_RULES: Record<Format, { life: number; commanderDamage: boolean }> = {
  commander: { life: 40, commanderDamage: true },
  duel: { life: 20, commanderDamage: false },
}

/** Règle 103.8 : à partir de 3 joueurs, le premier joueur pioche à son premier tour. */
export const FIRST_PLAYER_DRAWS_FROM = 3

export const COMMANDER_DAMAGE_LETHAL = 21
export const POISON_LETHAL = 10
export const OPENING_HAND = 7
export const SNAPSHOT_EVERY = 20
export const COMMANDER_TAX_STEP = 2

export type GameSetup = {
  format: Format
  players: { id: string; name: string; catalog: Catalog }[]
  options: { eliminatedSeeAll: boolean }
}

export type PlayerZone = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command'
export const PLAYER_ZONES: PlayerZone[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command']
export const HIDDEN_ZONES: PlayerZone[] = ['library', 'hand']

export type ZoneRef = { player: string; zone: PlayerZone }

export type Counters = { plus: number; minus: number; other: number }

export type PlayerState = {
  id: string
  name: string
  life: number
  poison: number
  counters: Record<string, number>
  commanderDamage: Record<string, number>
  eliminated: boolean
  kept: boolean
  mulligans: number
  topRevealed: boolean
  zones: Record<PlayerZone, string[]>
  stats: { drawn: number; landsPlayed: number }
}

export type CardInstance = {
  id: string
  owner: string
  ref: number | null
  token: TokenData | null
  isCommander: boolean
  tapped: boolean
  flipped: boolean
  faceDown: boolean
  counters: Counters
  x: number
  y: number
  knownBy: string[]
}

export type LogEntry = { turn: number; actor: string | null; text: string; visibleTo: string[] | 'all' }

export type GameState = {
  format: Format
  options: GameSetup['options']
  catalogs: Record<string, Catalog>
  players: Record<string, PlayerState>
  turnOrder: string[]
  activePlayer: string
  turn: number
  started: boolean
  firstTurnDone: boolean
  monarch: string | null
  initiative: string | null
  cards: Record<string, CardInstance>
  commanderCasts: Record<string, number>
  lookingAt: Record<string, string[]>
  nextTokenId: number
  log: LogEntry[]
}

export type Position = 'top' | 'bottom' | number

export type GameAction =
  | { type: 'start'; actor: 'server'; seed: number }
  | { type: 'mulligan'; actor: string; seed: number }
  | { type: 'keep'; actor: string }
  | { type: 'draw'; actor: string; count: number }
  | { type: 'shuffle'; actor: string; seed: number }
  | { type: 'endTurn'; actor: string; byHost?: boolean }
  | { type: 'move'; actor: string; id: string; to: ZoneRef; position?: Position; x?: number; y?: number; faceDown?: boolean }
  | { type: 'moveTop'; actor: string; to: ZoneRef; position?: Position; x?: number; y?: number; faceDown?: boolean }
  | { type: 'giveControl'; actor: string; id: string; to: string }
  | { type: 'tap'; actor: string; id: string }
  | { type: 'untapAll'; actor: string }
  | { type: 'flip'; actor: string; id: string }
  | { type: 'faceDown'; actor: string; id: string }
  | { type: 'counter'; actor: string; id: string; kind: keyof Counters; delta: number }
  | { type: 'createToken'; actor: string; token: TokenData; x: number; y: number }
  | { type: 'life'; actor: string; target: string; delta: number }
  | { type: 'poison'; actor: string; target: string; delta: number }
  | { type: 'playerCounter'; actor: string; target: string; name: string; delta: number }
  | { type: 'commanderDamage'; actor: string; target: string; commander: string; delta: number }
  | { type: 'commanderTax'; actor: string; id: string; delta: number }
  | { type: 'setMonarch'; actor: string; to: string | null }
  | { type: 'setInitiative'; actor: string; to: string | null }
  | { type: 'eliminate'; actor: string; target: string }
  | { type: 'reveal'; actor: string; ids: string[] | 'hand'; to: 'all' | string[] }
  | { type: 'revealTop'; actor: string }
  | { type: 'toggleTopRevealed'; actor: string }
  | { type: 'look'; actor: string; target: string; count: number }
  | { type: 'search'; actor: string; target: string }
  | { type: 'endLook'; actor: string; target: string; shuffle: boolean; seed?: number }

export type VisibleCard = {
  hidden: false
  id: string
  owner: string
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

export type CardView = { hidden: true } | VisibleCard

export type PlayerViewState = Omit<PlayerState, 'zones'> & {
  zones: Record<Exclude<PlayerZone, 'library'>, CardView[]> & {
    library: { count: number; visible: { index: number; card: VisibleCard }[] }
  }
}

export type PlayerView = {
  me: string
  format: Format
  turn: number
  activePlayer: string
  turnOrder: string[]
  monarch: string | null
  initiative: string | null
  players: Record<string, PlayerViewState>
  commanderCasts: Record<string, number>
  lookingAt: string[]
  log: Omit<LogEntry, 'visibleTo'>[]
  /** Renseigné par GameHistory / le serveur. */
  canUndo: boolean
}
