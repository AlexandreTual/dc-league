import type { Result } from '@/lib/db'
import { listDeckTokens } from '@/lib/db-cards'
import { getTable, INTERNAL_ERROR } from '@/lib/db-games'
import type { DeckToken } from '@/lib/game/types'

/**
 * Jetons du deck que le joueur a choisi à cette table, et seulement les siens : la liste révélerait
 * des cartes encore cachées d'un adversaire. Un joueur qui n'est pas assis (ou sans deck) n'en a aucun.
 */
export async function myTableTokens(db: D1Database, tableId: string, playerId: string): Promise<Result<DeckToken[]>> {
  const { data: table, error } = await getTable(db, tableId)
  if (error !== null) return { data: null, error: INTERNAL_ERROR }
  if (!table) return { data: null, error: 'Table introuvable' }
  const deckId = table.players.find((p) => p.playerId === playerId)?.deckId
  if (!deckId) return { data: [], error: null }
  const tokens = await listDeckTokens(db, deckId)
  return tokens.error !== null ? { data: null, error: INTERNAL_ERROR } : tokens
}
