// Règles d'affichage de la colonne joueur : vie basse, cascade du cimetière, portrait, emplacement d'un commandant.
import type { CardView, PlayerView, PlayerZone, VisibleCard } from './types'

export const LOW_LIFE = 10
export const GRAVEYARD_TAIL = 6

export const lifeLevel = (life: number): 'normal' | 'low' => (life <= LOW_LIFE ? 'low' : 'normal')

const visible = (cards: CardView[]) => cards.filter((c): c is VisibleCard => !c.hidden)

/** Les `n` dernières cartes visibles du cimetière, la plus récente en dernier (en bas de la cascade). */
export function graveyardTail(cards: CardView[], n = GRAVEYARD_TAIL): VisibleCard[] {
  return visible(cards).slice(-n)
}

const PLACES: [Exclude<PlayerZone, 'library'>, string][] = [
  ['command', 'zone de commandement'], ['battlefield', 'en jeu'], ['graveyard', 'au cimetière'], ['exile', 'en exil'], ['hand', 'en main'],
]

/** Premier commandant du joueur visible dans les zones publiques ou connues. */
export function portraitCard(view: PlayerView, player: string): VisibleCard | null {
  for (const p of Object.values(view.players)) {
    for (const [zone] of PLACES) {
      const found = visible(p.zones[zone]).find((c) => c.isCommander && c.owner === player)
      if (found) return found
    }
  }
  return null
}

export function commanderPlace(view: PlayerView, id: string): string | null {
  for (const p of Object.values(view.players)) {
    for (const [zone, label] of PLACES) if (visible(p.zones[zone]).some((c) => c.id === id)) return label
  }
  return null
}

export function frameOf(colors: string[], typeLine: string): 'W' | 'U' | 'B' | 'R' | 'G' | 'multi' | 'land' | 'colorless' {
  if (colors.length > 1) return 'multi'
  if (colors.length === 1) return colors[0] as 'W' | 'U' | 'B' | 'R' | 'G'
  return /Land|Terrain/.test(typeLine) ? 'land' : 'colorless'
}
