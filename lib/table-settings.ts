// Réglages d'affichage de la table (quadrillage, couleur du fond, taille des cartes, place des piles, animations, cimetière en liste), mémorisés sur l'appareil.

export type TableSettings = {
  /** Quadrillage discret sur les champs de bataille. */
  grid: boolean
  /** Couleur du fond des champs de bataille (#rrggbb), ou null pour le fond par défaut. */
  background: string | null
  /** Taille des cartes des grands champs de bataille (1 = taille automatique). */
  cardScale: number
  /** Bibliothèque, cimetière, exil et commandement en vignettes à droite de ma main (façon Moxfield, par défaut) ; false : dans ma colonne (ancienne disposition). */
  pilesBesideHand: boolean
  /** Animations des cartes en jeu, chacune activée ou non (fenêtre « Animations »). */
  cardEffects: CardEffects
  /** Capacités données ou perdues sur les cartes en jeu : symboles sur le bord gauche (par défaut) ou libellés. */
  abilityStyle: AbilityStyle
  /** Hauteur, en px, du haut de l'illustration sous le nom de chaque carte du cimetière en liste (ma colonne). */
  graveyardArt: number
}

export type AbilityStyle = 'icons' | 'labels'

/**
 * Animations, chacune activée ou non (fenêtre « Animations ») :
 * - des cartes en jeu : liseré et éclat d'arrivée des légendaires, entrée du commandant, créatures volantes qui flottent ;
 * - des joueurs et de la partie : vie, poison et blessures de commandant qui changent, monarque et initiative qui passent
 *   d'un joueur à l'autre, jeton du donjon qui avance, joueur éliminé et victoire, dé qui roule.
 */
export type CardEffects = {
  legendary: boolean
  commander: boolean
  flying: boolean
  life: boolean
  crowns: boolean
  dungeon: boolean
  elimination: boolean
  dice: boolean
}
export type CardEffect = keyof CardEffects

/** Animations proposées dans la fenêtre « Animations », par groupe, dans l'ordre d'affichage. */
export const CARD_EFFECTS: { id: CardEffect; label: string; hint: string; group: 'cards' | 'players' }[] = [
  { id: 'legendary', label: 'Légendaires', hint: 'Liseré doré, et éclat qui traverse la carte à son arrivée en jeu.', group: 'cards' },
  { id: 'commander', label: 'Entrée du commandant', hint: 'Il se pose avec un halo, des ondes dorées et une couronne.', group: 'cards' },
  { id: 'flying', label: 'Vol', hint: 'Les créatures volantes flottent au-dessus de leur ombre tant qu’elles ne sont pas engagées.', group: 'cards' },
  { id: 'life', label: 'Vie, poison et blessures', hint: 'Le compteur réagit et l’écart (« -3 », « +2 ») s’envole au-dessus du portrait.', group: 'players' },
  { id: 'crowns', label: 'Monarque et initiative', hint: 'La couronne et le drapeau volent d’un portrait à l’autre.', group: 'players' },
  { id: 'dungeon', label: 'Donjon', hint: 'Le jeton avance de salle en salle et la salle atteinte s’allume.', group: 'players' },
  { id: 'elimination', label: 'Élimination et victoire', hint: 'Portrait fissuré du joueur éliminé, confettis pour le gagnant.', group: 'players' },
  { id: 'dice', label: 'Dés', hint: 'Le dé roule avant d’afficher le résultat.', group: 'players' },
]
const EFFECT_IDS = CARD_EFFECTS.map((e) => e.id)
export const ALL_EFFECTS: CardEffects = Object.fromEntries(EFFECT_IDS.map((id) => [id, true])) as CardEffects
export const NO_EFFECTS: CardEffects = Object.fromEntries(EFFECT_IDS.map((id) => [id, false])) as CardEffects

/** Animations enregistrées : ancienne case unique (true / false) reprise pour toutes ; absentes ou illisibles : activées. */
function parseCardEffects(raw: unknown): CardEffects {
  if (raw === false) return NO_EFFECTS
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return ALL_EFFECTS
  const data = raw as Record<string, unknown>
  return Object.fromEntries(EFFECT_IDS.map((id) => [id, data[id] !== false])) as CardEffects
}

/** Tailles proposées dans Réglages (80 % à 150 %). */
export const CARD_SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5]
/** Hauteurs d'illustration proposées pour le cimetière en liste : petite, moyenne (par défaut), grande, très grande. */
export const GRAVEYARD_ARTS = [16, 36, 60, 90]
export const DEFAULT_TABLE_SETTINGS: TableSettings = { grid: true, background: null, cardScale: 1, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36 }
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
    // Absent (sauvegarde d'avant) ou illisible : la disposition par défaut, piles à côté de la main.
    const pilesBesideHand = data.pilesBesideHand !== false
    // Absentes (sauvegarde d'avant) ou illisibles : animations activées ; ancienne case « Animations des cartes » reprise.
    const cardEffects = parseCardEffects(data.cardEffects)
    // Absent (sauvegarde d'avant) ou illisible : les symboles.
    const abilityStyle: AbilityStyle = data.abilityStyle === 'labels' ? 'labels' : 'icons'
    // Absente (sauvegarde d'avant) ou hors liste : moyenne.
    const graveyardArt = GRAVEYARD_ARTS.includes(data.graveyardArt) ? data.graveyardArt : 36
    return { grid: data.grid, background: data.background?.toLowerCase() ?? null, cardScale, pilesBesideHand, cardEffects, abilityStyle, graveyardArt }
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
