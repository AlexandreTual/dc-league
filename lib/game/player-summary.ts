// Règles d'affichage de la colonne joueur : vie basse, cascade du cimetière, portrait, emplacement d'un commandant.
import type { Messages } from '@/lib/i18n/messages'
import type { CardView, PlayerView, PlayerZone, VisibleCard } from './types'

export const LOW_LIFE = 10
export const GRAVEYARD_TAIL = 6

export const lifeLevel = (life: number): 'normal' | 'low' => (life <= LOW_LIFE ? 'low' : 'normal')

const visible = (cards: CardView[]) => cards.filter((c): c is VisibleCard => !c.hidden)

/** Les `n` dernières cartes visibles du cimetière, la plus récente en dernier (en bas de la cascade). */
export function graveyardTail(cards: CardView[], n = GRAVEYARD_TAIL): VisibleCard[] {
  return visible(cards).slice(-n)
}

/** Tout le cimetière visible, la plus récente en premier (en haut de la liste de la colonne). */
export function graveyardList(cards: CardView[]): VisibleCard[] {
  return visible(cards).reverse()
}

/** Zones publiques ou connues où chercher un commandant, dans l'ordre. */
const PLACES: Exclude<PlayerZone, 'library'>[] = ['command', 'battlefield', 'graveyard', 'exile', 'hand']

/** Premier commandant du joueur visible dans les zones publiques ou connues. */
export function portraitCard(view: PlayerView, player: string): VisibleCard | null {
  for (const p of Object.values(view.players)) {
    for (const zone of PLACES) {
      const found = visible(p.zones[zone]).find((c) => c.isCommander && c.owner === player)
      if (found) return found
    }
  }
  return null
}

/** Où se trouve un commandant, en toutes lettres (« en jeu ») ; null s'il n'est pas visible. */
export function commanderPlace(view: PlayerView, id: string, t: Messages): string | null {
  for (const p of Object.values(view.players)) {
    for (const zone of PLACES) if (visible(p.zones[zone]).some((c) => c.id === id)) return t.table.zones.places[zone]
  }
  return null
}

export function frameOf(colors: string[], typeLine: string): 'W' | 'U' | 'B' | 'R' | 'G' | 'multi' | 'land' | 'colorless' {
  if (colors.length > 1) return 'multi'
  if (colors.length === 1) return colors[0] as 'W' | 'U' | 'B' | 'R' | 'G'
  return /Land|Terrain/.test(typeLine) ? 'land' : 'colorless'
}
