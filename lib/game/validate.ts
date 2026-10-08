// Validation des actions reçues d'un navigateur : rien n'y est fiable (types, bornes, champs en trop).
import type { ClientAction } from './room'
import { DICE_SIDES, MAX_DICE } from './dice'
import { MANA_COLORS, PLAYER_ZONES } from './types'

/** Plus grand écart accepté pour un compteur, des points de vie, du mana… */
export const MAX_DELTA = 1000
/** Plus grand nombre de cartes visées par une action (pioche, regard, révélation). */
export const MAX_CARDS = 250
const MAX_ID = 200
const MAX_NAME = 200
const SCRYFALL_IMAGES = 'https://cards.scryfall.io/'

const INVALID = Symbol('invalide')
const OMIT = Symbol('absent')
type Check = (v: unknown) => unknown

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const when = (test: (v: unknown) => boolean): Check => (v) => (test(v) ? v : INVALID)

const int = (min: number, max: number) => when((v) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max)
const finite = when((v) => typeof v === 'number' && Number.isFinite(v))
const str = (max: number, min = 1) => when((v) => typeof v === 'string' && v.length >= min && v.length <= max)
const bool = when((v) => typeof v === 'boolean')
const oneOf = (values: readonly unknown[]) => when((v) => values.includes(v))
const either = (...checks: Check[]): Check => (v) => {
  for (const check of checks) {
    const result = check(v)
    if (result !== INVALID) return result
  }
  return INVALID
}
const nullable = (check: Check) => either(when((v) => v === null), check)
const optional = (check: Check): Check => (v) => (v === undefined ? OMIT : check(v))
const listOf = (check: Check, max: number): Check => (v) => {
  if (!Array.isArray(v) || v.length === 0 || v.length > max) return INVALID
  const out = v.map(check)
  return out.includes(INVALID) ? INVALID : out
}

type Shape = Record<string, Check>

/** Objet ne gardant que les champs prévus ; le nom du premier champ invalide sinon. */
function pick(shape: Shape, value: Record<string, unknown>): Record<string, unknown> | { invalid: string } {
  const out: Record<string, unknown> = {}
  for (const [key, check] of Object.entries(shape)) {
    const result = check(Object.hasOwn(value, key) ? value[key] : undefined)
    if (result === INVALID) return { invalid: key }
    if (result !== OMIT) out[key] = result
  }
  return out
}

const object = (shape: Shape): Check => (v) => {
  if (!isObject(v)) return INVALID
  const out = pick(shape, v)
  return 'invalid' in out ? INVALID : out
}

const id = str(MAX_ID)
const player = str(MAX_ID)
const delta = int(-MAX_DELTA, MAX_DELTA)
const count = int(1, MAX_CARDS)
const zoneRef = object({ player, zone: oneOf(PLAYER_ZONES) })
const position = optional(either(oneOf(['top', 'bottom']), int(0, 10_000)))
const image = nullable(when((v) => typeof v === 'string' && v.length <= 500 && v.startsWith(SCRYFALL_IMAGES)))
const token = object({
  name: str(MAX_NAME),
  typeLine: str(MAX_NAME, 0),
  power: nullable(str(10, 0)),
  toughness: nullable(str(10, 0)),
  colors: either(when((v) => Array.isArray(v) && v.length === 0), listOf(oneOf(['W', 'U', 'B', 'R', 'G']), 5)),
  image,
  copy: optional(bool),
})
const placement = { position, x: optional(finite), y: optional(finite), faceDown: optional(bool) }

/** Champs attendus pour chaque type d'action envoyée par un joueur (auteur et graine sont posés par le serveur). */
const SHAPES: Record<ClientAction['type'], Shape> = {
  mulligan: {},
  keep: {},
  draw: { count },
  shuffle: {},
  endTurn: {},
  move: { id, to: zoneRef, ...placement },
  moveTop: { to: zoneRef, ...placement },
  giveControl: { id, to: player },
  tap: { id },
  untapAll: {},
  flip: { id },
  faceDown: { id },
  counter: { id, kind: oneOf(['plus', 'minus', 'other']), delta },
  pt: { id, power: delta, toughness: delta },
  createToken: { token, x: finite, y: finite, copy: optional(bool) },
  life: { target: player, delta },
  poison: { target: player, delta },
  playerCounter: { target: player, name: str(40), delta },
  commanderDamage: { target: player, commander: id, delta },
  commanderTax: { id, delta },
  setMonarch: { to: nullable(player) },
  setInitiative: { to: nullable(player) },
  eliminate: { target: player },
  reveal: { ids: either(oneOf(['hand']), listOf(id, MAX_CARDS)), to: either(oneOf(['all']), listOf(player, 10)) },
  revealTop: {},
  toggleTopRevealed: {},
  togglePeekTop: {},
  mana: { color: oneOf(MANA_COLORS), delta },
  clearMana: {},
  toggleKeepMana: {},
  look: { target: player, count },
  search: { target: player },
  reorderTop: { target: player, ids: listOf(id, MAX_CARDS) },
  endLook: { target: player, shuffle: bool },
  roll: { sides: oneOf(DICE_SIDES), count: int(1, MAX_DICE) },
}

/** L'action nettoyée (champs prévus seulement), ou un message d'erreur en français. */
export function parseClientAction(raw: unknown): ClientAction | string {
  if (!isObject(raw) || typeof raw.type !== 'string') return 'Action invalide'
  if (!Object.hasOwn(SHAPES, raw.type)) return 'Action inconnue'
  const out = pick(SHAPES[raw.type as ClientAction['type']], raw)
  if ('invalid' in out) return `Action invalide : ${out.invalid}`
  return { ...out, type: raw.type } as ClientAction
}
