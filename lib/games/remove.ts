// Utilisé par le site (admin) et par le Worker de jeu (nettoyage) : imports relatifs.
import type { Result } from '../db'
import { deleteTable, getTable } from '../db-games'
import { idleFor } from './idle'

/** Supprime la partie du Durable Object de la table ; true si le serveur de jeu l'a acceptée. */
export type DestroyGame = (tableId: string) => Promise<boolean>

export const GAME_SERVER_ERROR = 'Le serveur de jeu n’a pas pu supprimer la partie, réessaie plus tard'
export const TABLE_ACTIVE_ERROR = 'Cette partie a repris entre-temps : elle n’a pas été supprimée'

/** `idleBefore` : ne supprimer la table que si sa dernière activité est antérieure à cette date (relue en base). */
export type RemoveOptions = { idleBefore?: Date }

/**
 * Supprime une table : la partie d'abord (joueurs connectés déconnectés), puis la table et ses places.
 * Si la partie ne peut pas être supprimée, la table est gardée (pas de partie orpheline).
 * Avec `idleBefore`, une table touchée depuis cette date est refusée (suppression groupée des parties inactives).
 * Sans effet sur une table déjà supprimée (par le nettoyage ou un autre admin) : ce n'est pas une erreur.
 */
export async function removeTable(db: D1Database, destroy: DestroyGame, id: string, opts: RemoveOptions = {}): Promise<Result<null>> {
  if (opts.idleBefore) {
    const { data: table, error } = await getTable(db, id)
    if (error !== null) return { data: null, error }
    if (!table) return { data: null, error: null }
    if (idleFor(table.lastActivityAt, opts.idleBefore) === 0) return { data: null, error: TABLE_ACTIVE_ERROR }
  }
  let destroyed = false
  try {
    destroyed = await destroy(id)
  } catch (e) {
    console.error(`Suppression de la partie ${id} impossible`, e)
  }
  if (!destroyed) return { data: null, error: GAME_SERVER_ERROR }
  return deleteTable(db, id)
}
