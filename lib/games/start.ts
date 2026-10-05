import { listDeckCards } from '@/lib/db-cards'
import { INTERNAL_ERROR, claimStart, getTable, markPlaying, releaseStart, startCheck, type GameTable } from '@/lib/db-games'
import type { Result } from '@/lib/db'
import { buildCatalog } from '@/lib/game/catalog'
import type { GameSetup } from '@/lib/game/types'

export { INTERNAL_ERROR }

/** Crée la partie dans le Durable Object de la table. */
export type GameInit = (tableId: string, body: { setup: GameSetup; hostId: string }) => Promise<{ ok: boolean; status: number }>

/**
 * Démarre la partie : l'hôte seulement, conditions remplies ; catalogues construits depuis les decks choisis.
 * La table est d'abord réservée (`starting`) : plus personne ne rejoint, ne part ni ne change de deck pendant
 * la création de la partie, et deux démarrages simultanés n'en créent qu'un. En cas d'échec, elle redevient ouverte.
 */
export async function startTable(db: D1Database, init: GameInit, tableId: string, playerId: string): Promise<Result<GameTable>> {
  const { data: table, error } = await getTable(db, tableId)
  if (error !== null) return { data: null, error: INTERNAL_ERROR }
  if (!table) return { data: null, error: 'Table introuvable' }
  if (table.hostPlayerId !== playerId) return { data: null, error: "Seul l'hôte peut faire ça" }
  const reason = startCheck(table)
  if (reason) return { data: null, error: reason }

  const { data: claimed, error: claimError } = await claimStart(db, tableId, playerId)
  if (claimError !== null) return { data: null, error: INTERNAL_ERROR }
  if (!claimed) return { data: null, error: 'La partie a déjà commencé' }

  let started = false
  try {
    const result = await createGame(db, init, tableId)
    started = result.error === null
    return result
  } finally {
    // Échec, même par exception (serveur de jeu injoignable…) : la table redevient ouverte.
    if (!started && (await releaseStart(db, tableId)).error !== null) console.error(`Table ${tableId} restée en démarrage`)
  }
}

/** Table réservée : relue (places désormais figées), partie créée, table passée en cours. */
async function createGame(db: D1Database, init: GameInit, tableId: string): Promise<Result<GameTable>> {
  const { data: table, error } = await getTable(db, tableId)
  if (error !== null || !table) return { data: null, error: INTERNAL_ERROR }
  const reason = startCheck({ ...table, status: 'open' })
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
