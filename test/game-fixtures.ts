import { buildCatalog } from '@/lib/game/catalog'
import type { Format, GameSetup } from '@/lib/game/mp/types'
import { testDeckCards } from './factories'

const NAMES = ['Alex', 'Bob', 'Chloé', 'Dan', 'Eva']

/** Partie de test : joueurs p1…pn, chacun avec le deck de test (Kenrith, Sol Ring FR, 30 Forêts, Delver). */
export function setupFor(format: Format, n: number, options: Partial<GameSetup['options']> = {}): GameSetup {
  return {
    format,
    players: Array.from({ length: n }, (_, i) => ({
      id: `p${i + 1}`,
      name: NAMES[i],
      catalog: buildCatalog(`deck-p${i + 1}`, testDeckCards()).catalog,
    })),
    options: { eliminatedSeeAll: false, ...options },
  }
}

/** Identifiant d'un exemplaire du deck de test : ref 1 Kenrith, 2 Sol Ring, 3 Forêt, 4 Delver. */
export const card = (player: string, ref: number, n = 1) => `${player}:c${ref}-${n}`
