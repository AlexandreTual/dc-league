import type { CardFace, CardRow } from '@/lib/cards/types'
import type { Messages } from '@/lib/i18n/messages/fr'
import type { AbilityChoice, GainedAbility, Keyword } from './abilities'
import type { DungeonId, DungeonPosition } from './dungeons'

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
  /** Jeton créé comme copie d'une carte en jeu (mention « Copie » sur la table). */
  copy?: boolean
  /** Capacités imprimées (mots-clés anglais de Scryfall : « Flying »…) ; absentes : aucune, ou jeton créé avant leur ajout. */
  keywords?: string[]
}

/** Jeton créé par une ou plusieurs cartes du deck (onglet « Du deck » de « Créer un jeton »). */
export type DeckToken = TokenData & { sources: string[] }

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

/** Réserve de mana : Blanc, Bleu, Noir, Rouge, Vert, Incolore. */
export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C'
export const MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C']
export type ManaPool = Record<ManaColor, number>
export const NO_MANA: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }

export type PlayerZone = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command'
export const PLAYER_ZONES: PlayerZone[] = ['library', 'hand', 'battlefield', 'graveyard', 'exile', 'command']
export const HIDDEN_ZONES: PlayerZone[] = ['library', 'hand']

export type ZoneRef = { player: string; zone: PlayerZone }

export type Counters = { plus: number; minus: number; other: number }

/** Modification libre de la force et de l'endurance d'une carte en jeu (effets « +3/+3 jusqu'à la fin du tour »…). */
export type PtMod = { power: number; toughness: number }

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
  /** Le propriétaire voit en permanence la carte du dessus de sa bibliothèque, les autres non (Bolas's Citadel…). */
  peekTop: boolean
  /** Réserve de mana, publique ; vidée à chaque passage de tour sauf si `keepMana`. */
  mana: ManaPool
  keepMana: boolean
  zones: Record<PlayerZone, string[]>
  stats: { drawn: number; landsPlayed: number }
  /**
   * Donjon en cours et salle du jeton ; sur la dernière salle, le donjon est terminé (jusqu'à la prochaine exploration).
   * Absent : jamais entré dans un donjon (ou serveur de jeu plus ancien, côté navigateur).
   */
  dungeon?: DungeonPosition
  /** Donjons terminés ; absent : aucun (ou serveur de jeu plus ancien). */
  dungeonsDone?: number
}

/** Dans `knownBy` : carte révélée à tous (joueurs et spectateurs), jusqu'à ce qu'elle bouge. */
export const EVERYONE = '*'

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
  /** Absent : aucune modification (0/0), et toujours absent hors du champ de bataille. */
  ptMod?: PtMod
  /** Modification de force et d'endurance jusqu'à la fin du tour ; absent : aucune, et toujours hors du champ de bataille. */
  ptTurn?: PtMod
  /** Marqueurs loyauté ajoutés (ou retirés) depuis la loyauté imprimée ; absent : aucun écart, et toujours hors du champ de bataille. */
  loyaltyMod?: number
  /** Pivotée à 180° (ex. jeton imprimé tête-bêche) ; absent sinon, et toujours hors du champ de bataille. */
  rotated?: true
  /** Hors phase (règle 702.26) : traitée comme absente jusqu'à son retour ; absent sinon, et toujours hors du champ de bataille. */
  phasedOut?: true
  /** Capacités données (« Donner une capacité… ») ; absent : aucune, et toujours hors du champ de bataille. */
  gained?: GainedAbility[]
  /** Capacités imprimées perdues ; absent : aucune, et toujours hors du champ de bataille. */
  lost?: Keyword[]
  x: number
  y: number
  knownBy: string[]
}

/** Carte nommée dans une ligne du journal : son nom est lu dans le catalogue de `owner`, dans la langue des cartes du lecteur. */
export type LogCard = { owner: string; ref: number | null; token?: string }

/**
 * Valeur d'une ligne structurée du journal. Une carte (`card`, `cards` ; `null` : carte face cachée) n'y figure que
 * si la phrase française la nomme déjà, avec la même visibilité ; `zone` : zone de l'auteur, ou du joueur `of`.
 */
export type LogParam =
  | string
  | number
  | number[]
  | { card: LogCard }
  | { cards: (LogCard | null)[] }
  | { player: string }
  | { players: string[] }
  | { zone: PlayerZone; of?: string }
  | { abilities: { keyword: Keyword; param?: string }[] }
  | { changed: { keyword: Keyword; param: string }[] }
  | { keywords: Keyword[] }

/** Clé d'une phrase du journal (dictionnaire `log.lines`). */
export type LogKey = keyof Messages['log']['lines']

/** Ligne à traduire côté navigateur (lib/game/log-format.ts). */
export type LogMessage = { key: LogKey; params?: Record<string, LogParam> }

/**
 * `roll` : lancer de dés, affiché aussi à son auteur (absent avec un serveur de jeu plus ancien).
 * `text` : la phrase en français, toujours écrite (lue par les navigateurs plus anciens) ; `msg` : la même ligne
 * structurée, absente des lignes écrites par un serveur de jeu plus ancien.
 */
export type LogEntry = { turn: number; actor: string | null; text: string; visibleTo: string[] | 'all'; roll?: true; msg?: LogMessage }

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
  /** Premier joueur choisi par l'hôte (sinon tiré au sort). */
  firstChosen: boolean
  monarch: string | null
  initiative: string | null
  /** Joueurs à qui l'exploration des Souterrains est proposée (initiative prise, début de tour) ; absent : aucun. */
  ventureOffers?: string[]
  cards: Record<string, CardInstance>
  commanderCasts: Record<string, number>
  lookingAt: Record<string, string[]>
  /**
   * Cartes posées dessus ou dessous d'une bibliothèque regardée, par joueur qui regarde : épargnées par le mélange
   * en fin de recherche. Jamais envoyé aux navigateurs (absent des parties plus anciennes).
   */
  lookKept?: Record<string, { top: string[]; bottom: string[] }>
  nextTokenId: number
  log: LogEntry[]
  /**
   * Minuteur, d'après l'horodatage serveur (`at`) des actions qui changent de tour ; absent en mode test
   * et pour les actions jouées avant l'horodatage. Instants en millisecondes.
   */
  startedAt?: number
  /** Début du tour en cours. */
  turnStartedAt?: number
  /** Temps de jeu par joueur (ms) : somme de ses tours terminés, le tour en cours non compris. */
  playTime?: Record<string, number>
}

export type Position = 'top' | 'bottom' | number

/**
 * Graine du hasard. Nombre : ancienne graine 32 bits (parties commencées avant le passage à 128 bits,
 * rejouées à l'identique) ; texte : 128 bits tirés par `crypto.getRandomValues` (voir random.ts).
 */
export type Seed = number | string

/** Instant serveur (ms) posé sur `start`, `endTurn` et `eliminate` : sert au minuteur, jamais repris du navigateur. */
export type Stamp = { at?: number }

export type GameAction = Stamp & (
  /**
   * `seeds` : graine de la bibliothèque de chaque joueur ; absente des anciennes parties (graine + rang du joueur).
   * `first` : premier joueur choisi par l'hôte ; absent : tirage au sort.
   */
  | { type: 'start'; actor: 'server'; seed: Seed; seeds?: Record<string, Seed>; first?: string }
  | { type: 'mulligan'; actor: string; seed: Seed }
  | { type: 'keep'; actor: string }
  | { type: 'draw'; actor: string; count: number }
  | { type: 'shuffle'; actor: string; seed: Seed }
  | { type: 'endTurn'; actor: string; byHost?: boolean }
  | { type: 'move'; actor: string; id: string; to: ZoneRef; position?: Position; x?: number; y?: number; faceDown?: boolean }
  | { type: 'moveTop'; actor: string; to: ZoneRef; position?: Position; x?: number; y?: number; faceDown?: boolean }
  /**
   * Plusieurs cartes d'une même zone déplacées d'un coup (sélection) : vers mon champ de bataille, sinon vers la zone
   * de chaque propriétaire. `ids` dans l'ordre choisi : la première finit au-dessus (bibliothèque, cimetière, exil) ;
   * `places` : position de chaque carte posée sur le champ de bataille ; `random` : ordre tiré au sort avec `seed`
   * (posée par le serveur).
   */
  | { type: 'moveMany'; actor: string; ids: string[]; zone: PlayerZone; position?: 'top' | 'bottom'; places?: { x: number; y: number }[]; random?: boolean; seed?: Seed }
  | { type: 'giveControl'; actor: string; id: string; to: string }
  | { type: 'tap'; actor: string; id: string }
  | { type: 'untapAll'; actor: string }
  | { type: 'flip'; actor: string; id: string }
  /** Pivote une carte en jeu à 180° (et retour). */
  | { type: 'rotate'; actor: string; id: string }
  | { type: 'faceDown'; actor: string; id: string }
  /** Fait passer un permanent hors phase (et revenir en phase). */
  | { type: 'phase'; actor: string; id: string }
  | { type: 'counter'; actor: string; id: string; kind: keyof Counters; delta: number }
  /** Écart ajouté à la modification de force et d'endurance d'une carte en jeu. */
  | { type: 'pt'; actor: string; id: string; power: number; toughness: number }
  /** Écart ajouté à la modification de force et d'endurance jusqu'à la fin du tour. */
  | { type: 'ptTurn'; actor: string; id: string; power: number; toughness: number }
  /**
   * Effet sur plusieurs permanents (Finale of Devastation…) : écart de force et d'endurance et capacités ajoutées,
   * pour toujours ou jusqu'à la fin du tour ; une seule ligne de journal.
   */
  | { type: 'effect'; actor: string; ids: string[]; power: number; toughness: number; gained: AbilityChoice[]; untilEndOfTurn?: boolean }
  | { type: 'loyalty'; actor: string; id: string; delta: number }
  /** Capacités voulues du permanent (données, imprimées perdues) ; `untilEndOfTurn` : durée de celles ajoutées. */
  | { type: 'abilities'; actor: string; id: string; gained: AbilityChoice[]; lost: Keyword[]; untilEndOfTurn?: boolean }
  | { type: 'createToken'; actor: string; token: TokenData; x: number; y: number; copy?: boolean }
  | { type: 'life'; actor: string; target: string; delta: number }
  | { type: 'poison'; actor: string; target: string; delta: number }
  | { type: 'playerCounter'; actor: string; target: string; name: string; delta: number }
  | { type: 'commanderDamage'; actor: string; target: string; commander: string; delta: number }
  | { type: 'commanderTax'; actor: string; id: string; delta: number }
  | { type: 'setMonarch'; actor: string; to: string | null }
  | { type: 'setInitiative'; actor: string; to: string | null }
  /**
   * Explore pour son auteur : Les Souterrains (`undercity`, initiative) ou le donjon. `dungeon` : donjon choisi quand il
   * faut en commencer un ; `room` : salle suivante quand il y en a deux.
   */
  | { type: 'venture'; actor: string; undercity?: boolean; dungeon?: DungeonId; room?: string }
  /** « Plus tard » : retire l'exploration des Souterrains proposée. */
  | { type: 'skipVenture'; actor: string }
  | { type: 'eliminate'; actor: string; target: string }
  | { type: 'reveal'; actor: string; ids: string[] | 'hand'; to: 'all' | string[] }
  | { type: 'revealTop'; actor: string }
  | { type: 'toggleTopRevealed'; actor: string }
  | { type: 'togglePeekTop'; actor: string }
  | { type: 'mana'; actor: string; color: ManaColor; delta: number }
  | { type: 'clearMana'; actor: string }
  | { type: 'toggleKeepMana'; actor: string }
  | { type: 'look'; actor: string; target: string; count: number }
  | { type: 'search'; actor: string; target: string }
  | { type: 'reorderTop'; actor: string; target: string; ids: string[] }
  /** `keep` : les cartes posées dessus ou dessous pendant le regard échappent au mélange (absent des actions plus anciennes). */
  | { type: 'endLook'; actor: string; target: string; shuffle: boolean; seed?: Seed; keep?: true }
  /** `sides` : 2 (pile ou face), 4, 6, 8, 10, 12 ou 20 ; `count` : nombre de dés lancés ensemble. */
  | { type: 'roll'; actor: string; sides: number; count: number; seed: Seed }
)

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
  /** Absent : aucune modification, ou serveur de jeu plus ancien. */
  ptMod?: PtMod
  /** Modification jusqu'à la fin du tour ; absent : aucune, ou serveur de jeu plus ancien. */
  ptTurn?: PtMod
  /** Absent : aucun écart de loyauté, ou serveur de jeu plus ancien. */
  loyaltyMod?: number
  /** Absent : non pivotée, ou serveur de jeu plus ancien. */
  rotated?: true
  /** Absent : en phase, ou serveur de jeu plus ancien. */
  phasedOut?: true
  /** Absent : aucune capacité donnée, ou serveur de jeu plus ancien. */
  gained?: GainedAbility[]
  /** Absent : aucune capacité imprimée perdue, ou serveur de jeu plus ancien. */
  lost?: Keyword[]
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
  /** Premier joueur choisi par l'hôte. Absent avec un serveur de jeu plus ancien : compter un tirage au sort. */
  firstChosen?: boolean
  monarch: string | null
  initiative: string | null
  /** Joueurs à qui l'exploration des Souterrains est proposée. Absent avec un serveur de jeu plus ancien : aucun. */
  ventureOffers?: string[]
  players: Record<string, PlayerViewState>
  commanderCasts: Record<string, number>
  lookingAt: string[]
  /** Dernières lignes du journal visibles par ce joueur (au plus VIEW_LOG_LIMIT). */
  log: Omit<LogEntry, 'visibleTo'>[]
  /**
   * Rang, dans le journal complet visible par ce joueur, de la première ligne de `log`.
   * Absent avec un serveur de jeu plus ancien (journal non tronqué) : compter 0.
   */
  logStart?: number
  /** Renseigné par GameHistory / le serveur. */
  canUndo: boolean
}
