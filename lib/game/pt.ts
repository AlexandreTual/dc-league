// Force et endurance d'une carte en jeu : imprimée (ou 2/2 face cachée), plus marqueurs et modification libre.
import type { CardInstance, Catalog, PtMod } from './types'

export const NO_PT: PtMod = { power: 0, toughness: 0 }
/** Plus grande modification gardée, dans un sens comme dans l'autre. */
export const MAX_PT_MOD = 999

type PtCard = Pick<CardInstance, 'ref' | 'token' | 'flipped' | 'faceDown' | 'counters' | 'ptMod'>
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
  const entry = card.ref === null ? undefined : catalog?.entries.find((e) => e.ref === card.ref)
  if (!entry) return null
  const faces = entry.en.faces
  if (card.flipped && faces && faces.length > 1) return pair(faces[1].power, faces[1].toughness)
  return pair(entry.en.power, entry.en.toughness)
}

function valueOf(base: string | null, delta: number): PtValue {
  if (base === null) return { text: signed(delta), delta, value: null }
  if (/^-?\d+$/.test(base)) {
    const value = Number(base) + delta
    return { text: String(value), delta, value }
  }
  return { text: delta === 0 ? base : `${base}${signed(delta)}`, delta, value: null }
}

/**
 * Force et endurance affichées : base + marqueurs +1/+1 − marqueurs -1/-1 + modification libre.
 * Sans base connue, seulement l'écart, et null s'il est nul (rien à afficher).
 */
export function ptStats(catalog: Catalog | undefined, card: PtCard): PtStats | null {
  const base = basePT(catalog, card)
  const mod = card.ptMod ?? NO_PT
  const counters = card.counters.plus - card.counters.minus
  const power = counters + mod.power
  const toughness = counters + mod.toughness
  if (!base && power === 0 && toughness === 0) return null
  return { power: valueOf(base?.power ?? null, power), toughness: valueOf(base?.toughness ?? null, toughness), base: base !== null }
}

/** Texte du journal : « 5/4 (+3/+2) », la modification libre entre parenthèses quand il y en a une. */
export function ptLog(catalog: Catalog | undefined, card: PtCard): string {
  const stats = ptStats(catalog, card)
  if (!stats) return 'force et endurance d’origine'
  const shown = `${stats.power.text}/${stats.toughness.text}`
  const mod = card.ptMod ?? NO_PT
  if (!stats.base || (mod.power === 0 && mod.toughness === 0)) return shown
  return `${shown} (${signed(mod.power)}/${signed(mod.toughness)})`
}
