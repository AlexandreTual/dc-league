// Réglages d'affichage de la table (quadrillage, couleur du fond, taille des cartes, place des piles), mémorisés sur l'appareil.

export type TableSettings = {
  /** Quadrillage discret sur les champs de bataille. */
  grid: boolean
  /** Couleur du fond des champs de bataille (#rrggbb), ou null pour le fond par défaut. */
  background: string | null
  /** Taille des cartes des grands champs de bataille (1 = taille automatique). */
  cardScale: number
  /** Bibliothèque, cimetière, exil et commandement en vignettes à droite de ma main (façon Moxfield), plutôt que dans ma colonne. */
  pilesBesideHand: boolean
}

/** Tailles proposées dans Réglages (80 % à 150 %). */
export const CARD_SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5]
export const DEFAULT_TABLE_SETTINGS: TableSettings = { grid: true, background: null, cardScale: 1, pilesBesideHand: false }
const KEY = 'dc-table-settings'
const HEX = /^#[0-9a-f]{6}$/i
const GRID_SIZE = 24

/** Réglages enregistrés ; ceux par défaut si absents ou illisibles. */
export function parseTableSettings(raw: string | null): TableSettings {
  try {
    const data = JSON.parse(raw ?? '')
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return DEFAULT_TABLE_SETTINGS
    if (typeof data.grid !== 'boolean') return DEFAULT_TABLE_SETTINGS
    if (data.background !== null && !(typeof data.background === 'string' && HEX.test(data.background))) return DEFAULT_TABLE_SETTINGS
    // Taille absente (sauvegarde d'avant) ou hors liste : 100 %, sans perdre les autres réglages.
    const cardScale = CARD_SCALES.includes(data.cardScale) ? data.cardScale : 1
    const pilesBesideHand = data.pilesBesideHand === true
    return { grid: data.grid, background: data.background?.toLowerCase() ?? null, cardScale, pilesBesideHand }
  } catch {
    return DEFAULT_TABLE_SETTINGS
  }
}

export function loadTableSettings(): TableSettings {
  try {
    return parseTableSettings(localStorage.getItem(KEY))
  } catch {
    return DEFAULT_TABLE_SETTINGS
  }
}

export function saveTableSettings(settings: TableSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // réglage non mémorisé (navigation privée…)
  }
}

/** Fond clair : luminance perçue au-dessus de la moitié. */
function isLight(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.299 * r + 0.587 * g + 0.114 * b > 128
}

/** Style du fond d'un champ de bataille : couleur choisie et quadrillage (deux dégradés, aucune image externe). */
export function battlefieldStyle(settings: TableSettings): { backgroundColor?: string; backgroundImage?: string; backgroundSize?: string } {
  const style: { backgroundColor?: string; backgroundImage?: string; backgroundSize?: string } = {}
  if (settings.background) style.backgroundColor = settings.background
  if (settings.grid) {
    const line = settings.background && isLight(settings.background) ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)'
    style.backgroundImage = `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`
    style.backgroundSize = `${GRID_SIZE}px ${GRID_SIZE}px`
  }
  return style
}

/** Largeur d'une carte sur un grand champ de bataille : 7 % de sa largeur, au moins 72 px, multipliés par le réglage. */
export function cardSize(scale: number): { width: string; minWidth: string } {
  return { width: `${Math.round(7 * scale * 10) / 10}%`, minWidth: `${Math.round(72 * scale)}px` }
}
