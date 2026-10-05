import { listDeckCards } from '@/lib/db-cards'
import { INTERNAL_ERROR, getTable, markPlaying, startCheck, type GameTable } from '@/lib/db-games'
import type { Result } from '@/lib/db'
import { buildCatalog } from '@/lib/game/catalog'
import type { GameSetup } from '@/lib/game/types'

export { INTERNAL_ERROR }

/** Crée la partie dans le Durable Object de la table. */
export type GameInit = (tableId: string, body: { setup: GameSetup; hostId: string }) => Promise<{ ok: boolean; status: number }>

/** Démarre la partie : l'hôte seulement, conditions remplies ; catalogues construits depuis les decks choisis. */
export async function startTable(db: D1Database, init: GameInit, tableId: string, playerId: string): Promise<Result<GameTable>> {
  const { data: table, error } = await getTable(db, tableId)
  if (error !== null) return { data: null, error: INTERNAL_ERROR }
  if (!table) return { data: null, error: 'Table introuvable' }
  if (table.hostPlayerId !== playerId) return { data: null, error: "Seul l'hôte peut faire ça" }
  const reason = startCheck(table)
  if (reason) return { data: null, error: reason }

  const players: GameSetup['players'] = []
  for (const p of table.players) {
    const { data: cards, error: cardsError } = await listDeckCards(db, p.deckId!)
    if (cardsError !== null) return { data: null, error: INTERNAL_ERROR }
    players.push({ id: p.playerId, name: p.name, catalog: buildCatalog(p.deckId!, cards).catalog })
  }
  const setup: GameSetup = { format: table.format, players, options: { eliminatedSeeAll: table.eliminatedSeeAll } }

  // 409 : partie déjà créée lors d'un essai précédent interrompu, on termine le démarrage.
  const res = await init(tableId, { setup, hostId: table.hostPlayerId })
  if (!res.ok && res.status !== 409) return { data: null, error: INTERNAL_ERROR }
  if ((await markPlaying(db, tableId)).error !== null) return { data: null, error: INTERNAL_ERROR }
  const { data: started } = await getTable(db, tableId)
  return started ? { data: started, error: null } : { data: null, error: INTERNAL_ERROR }
}
