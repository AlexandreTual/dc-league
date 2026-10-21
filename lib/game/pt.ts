// Force et endurance d'une carte en jeu : imprimée (ou 2/2 face cachée), plus marqueurs et modifications libres
// (pour toujours, et jusqu'à la fin du tour).
import { catalogEntry } from './catalog'
import type { CardInstance, Catalog, PtMod } from './types'

export const NO_PT: PtMod = { power: 0, toughness: 0 }
/** Plus grande modification gardée, dans un sens comme dans l'autre. */
export const MAX_PT_MOD = 999

type PtCard = Pick<CardInstance, 'ref' | 'token' | 'flipped' | 'faceDown' | 'counters' | 'ptMod' | 'ptTurn'>
type Base = { power: string; toughness: string }

/** Une valeur affichée : `value` numérique quand la base l'est, `delta` = écart avec la base. */
export type PtValue = { text: string; delta: number; value: number | null }
/** `base` : false quand la carte n'a pas de force connue (seul l'écart est affiché). */
export type PtStats = { power: PtValue; toughness: PtValue; base: boolean }

const FACE_DOWN: Base = { power: '2', toughness: '2' }

export const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`)

const pair = (power: string | null | undefined, toughness: string | null | undefined): Base | null =>
  power != null && toughness != null ? { power, toughness } : null

/**
 * Force et endurance imprimées de la face visible : celles du jeton, du verso d'une carte transformée,
 * 2/2 pour une carte face cachée (règle 708.2). Null si la carte n'en a pas ou si elles sont inconnues
 * (carte enregistrée avant leur ajout, catalogue d'un serveur de jeu plus ancien).
 */
export function basePT(catalog: Catalog | undefined, card: Pick<CardInstance, 'ref' | 'token' | 'flipped' | 'faceDown'>): Base | null {
  if (card.faceDown) return FACE_DOWN
  if (card.token) return pair(card.token.power, card.token.toughness)
  const entry = catalogEntry(catalog, card.ref)
  if (!entry) return null
  const faces = entry.en.faces
  if (card.flipped && faces && faces.length > 1) return pair(faces[1].power, faces[1].toughness)
  return pair(entry.en.power, entry.en.toughness)
}

export function valueOf(base: string | null, delta: number): PtValue {
  if (base === null) return { text: signed(delta), delta, value: null }
  if (/^-?\d+$/.test(base)) {
    const value = Number(base) + delta
    return { text: String(value), delta, value }
  }
  return { text: delta === 0 ? base : `${base}${signed(delta)}`, delta, value: null }
}

/** Modification libre totale : pour toujours plus jusqu'à la fin du tour. */
export function totalMod(card: Pick<CardInstance, 'ptMod' | 'ptTurn'>): PtMod {
  const mod = card.ptMod ?? NO_PT
  const turn = card.ptTurn ?? NO_PT
  return { power: mod.power + turn.power, toughness: mod.toughness + turn.toughness }
}

const isZero = (mod: PtMod | undefined) => !mod || (mod.power === 0 && mod.toughness === 0)

/** « +3/+2 ». */
export const ptText = (mod: PtMod) => `${signed(mod.power)}/${signed(mod.toughness)}`

/**
 * Force et endurance affichées : base + marqueurs +1/+1 − marqueurs -1/-1 + modifications libres.
 * Sans base connue, seulement l'écart, et null s'il est nul (rien à afficher).
 */
export function ptStats(catalog: Catalog | undefined, card: PtCard): PtStats | null {
  const base = basePT(catalog, card)
  const mod = totalMod(card)
  const counters = card.counters.plus - card.counters.minus
  const power = counters + mod.power
  const toughness = counters + mod.toughness
  if (!base && power === 0 && toughness === 0) return null
  return { power: valueOf(base?.power ?? null, power), toughness: valueOf(base?.toughness ?? null, toughness), base: base !== null }
}

/**
 * Texte du journal : « 5/4 (+3/+2) », les modifications libres entre parenthèses quand il y en a,
 * celle jusqu'à la fin du tour suivie de « ce tour » (« 9/8 (+1/+0, +3/+3 ce tour) »).
 */
export function ptLog(catalog: Catalog | undefined, card: PtCard): string {
  const stats = ptStats(catalog, card)
  if (!stats) return 'force et endurance d’origine'
  const shown = `${stats.power.text}/${stats.toughness.text}`
  if (!stats.base) return shown
  const mods = [
    ...(isZero(card.ptMod) ? [] : [ptText(card.ptMod!)]),
    ...(isZero(card.ptTurn) ? [] : [`${ptText(card.ptTurn!)} ce tour`]),
  ]
  return mods.length > 0 ? `${shown} (${mods.join(', ')})` : shown
}
