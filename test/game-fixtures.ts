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

/** Construit une situation de test : déplace des cartes à la main, sans passer par le moteur. */
export function place(
  state: import('@/lib/game/mp/types').GameState,
  moves: { id: string; player: string; zone: import('@/lib/game/mp/types').PlayerZone }[],
): import('@/lib/game/mp/types').GameState {
  const players = structuredClone(state.players)
  for (const { id, player, zone } of moves) {
    for (const p of Object.values(players)) {
      for (const z of Object.keys(p.zones) as (keyof typeof p.zones)[]) p.zones[z] = p.zones[z].filter((x) => x !== id)
    }
    players[player].zones[zone].push(id)
  }
  return { ...state, players, started: true }
}
