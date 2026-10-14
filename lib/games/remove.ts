// Utilisé par le site (admin) et par le Worker de jeu (nettoyage) : imports relatifs.
import type { Result } from '../db'
import { deleteTable, getTable } from '../db-games'

/** Supprime la partie du Durable Object de la table ; true si le serveur de jeu l'a acceptée. */
export type DestroyGame = (tableId: string) => Promise<boolean>

export const GAME_SERVER_ERROR = 'Le serveur de jeu n’a pas pu supprimer la partie, réessaie plus tard'

/**
 * Supprime une table : la partie d'abord (joueurs connectés déconnectés), puis la table et ses places.
 * Si la partie ne peut pas être supprimée, la table est gardée (pas de partie orpheline).
 */
export async function removeTable(db: D1Database, destroy: DestroyGame, id: string): Promise<Result<null>> {
  const { data: table, error } = await getTable(db, id)
  if (error !== null) return { data: null, error }
  if (!table) return { data: null, error: 'Table introuvable' }
  let destroyed = false
  try {
    destroyed = await destroy(id)
  } catch (e) {
    console.error(`Suppression de la partie ${id} impossible`, e)
  }
  if (!destroyed) return { data: null, error: GAME_SERVER_ERROR }
  return deleteTable(db, id)
}
