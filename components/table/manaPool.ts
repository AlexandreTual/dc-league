// Réserve de mana sur le champ de bataille : calculs purs (couleurs affichées, effet d'un clic, place du détail).
import { MANA_COLORS, type ManaColor, type ManaPool } from '@/lib/game/types'

/** Ma réserve : les 6 couleurs, même à 0 ; celle d'un autre (lecture seule) : les couleurs non nulles. Absente : rien. */
export function boardColors(pool: ManaPool | undefined, editable: boolean): ManaColor[] {
  if (!pool) return []
  return editable ? [...MANA_COLORS] : MANA_COLORS.filter((c) => pool[c] > 0)
}

export const manaTotal = (pool: ManaPool | undefined) => (pool ? MANA_COLORS.reduce((n, c) => n + pool[c], 0) : 0)

/** Clic sur un symbole : +1, Maj+clic : +5 (le clic droit retire 1). */
export const clickDelta = (e: { shiftKey: boolean }) => (e.shiftKey ? 5 : 1)

/** Largeur du détail (w-60) et marge au bord de l'écran. */
const DETAIL_WIDTH = 240
const MARGIN = 8
const GAP = 4

/** Détail ouvert au-dessus de la réserve (en bas du champ de bataille), aligné à gauche, gardé dans l'écran. */
export function detailPosition(anchor: { left: number; top: number }, screen: { width: number; height: number }) {
  return {
    left: Math.max(MARGIN, Math.min(anchor.left, screen.width - DETAIL_WIDTH - MARGIN)),
    bottom: screen.height - anchor.top + GAP,
  }
}
