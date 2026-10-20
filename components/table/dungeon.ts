// Donjons à la table : ouverture du plan depuis n'importe où (portrait, bulle, proposition), et lancement d'une exploration.
import { ventureStep, type DungeonId } from '@/lib/game/dungeons'
import type { ClientAction } from '@/lib/game/room'
import type { PlayerView } from '@/lib/game/types'

/**
 * Plan à ouvrir : `player` dont on regarde le donjon, `dungeon` l'onglet voulu ; `mode` : je dois explorer
 * (`dungeon` : « explorer le donjon », `undercity` : Les Souterrains) et le plan propose le choix à faire.
 */
export type DungeonRequest = { player?: string; dungeon?: DungeonId; mode?: 'dungeon' | 'undercity' }

const EVENT = 'dc-dungeon'

export function openDungeon(request: DungeonRequest): void {
  window.dispatchEvent(new CustomEvent<DungeonRequest>(EVENT, { detail: request }))
}

export function onDungeonRequest(listener: (request: DungeonRequest) => void): () => void {
  const handler = (e: Event) => listener((e as CustomEvent<DungeonRequest>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

/** Serveur de jeu qui connaît les donjons (champ absent avec un serveur plus ancien). */
export const hasDungeons = (view: PlayerView) => Array.isArray(view.ventureOffers)

/** Explore pour moi : envoyé directement sans choix à faire, sinon le plan s'ouvre sur le choix (donjon ou chemin). */
export function venture(view: PlayerView, mode: 'dungeon' | 'undercity', send: (action: ClientAction) => void): void {
  const step = ventureStep(view.players[view.me]?.dungeon, mode)
  const undercity = mode === 'undercity' ? { undercity: true } : {}
  if (step.kind === 'enter' || (step.kind === 'advance' && step.next.length === 1)) send({ type: 'venture', ...undercity })
  else openDungeon({ player: view.me, mode, ...(step.kind === 'advance' ? { dungeon: step.dungeon } : {}) })
}
