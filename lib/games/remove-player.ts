import { deletePlayer, playerDeleteRefusal, type Result } from '@/lib/db'
import { hostedTables } from '@/lib/db-games'
import { removeTable, type DestroyGame } from './remove'

/**
 * Supprime un joueur (administration). Les tables dont il est l'hôte partent avec lui en cascade : leur partie
 * est d'abord supprimée du serveur de jeu, sinon elle y resterait pour toujours (le nettoyage part des tables
 * en base). Si le serveur de jeu refuse, rien de plus n'est supprimé et l'admin peut réessayer.
 * Les refus habituels (historique de ligue, dernier admin) sont lus avant de toucher aux tables.
 */
export async function removePlayer(db: D1Database, destroy: DestroyGame, id: string): Promise<Result<true>> {
  const refusal = await playerDeleteRefusal(db, id)
  if (refusal.error !== null) return refusal
  if (refusal.data !== null) return { data: null, error: refusal.data }

  const tables = await hostedTables(db, id)
  if (tables.error !== null) return tables
  for (const tableId of tables.data) {
    const removed = await removeTable(db, destroy, tableId)
    if (removed.error !== null) return removed
  }
  return deletePlayer(db, id)
}
