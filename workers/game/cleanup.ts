import { deleteTable, playingTables, staleTables } from '../../lib/db-games'

/** Durée sans activité au-delà de laquelle une table est supprimée. */
export const STALE_AFTER_MS = 7 * 24 * 3600 * 1000

type CleanupEnv = { DB: D1Database; GAME: DurableObjectNamespace }

const stub = (env: CleanupEnv, id: string) => env.GAME.get(env.GAME.idFromName(id))

/**
 * Nettoyage périodique, table par table (l'échec de l'une n'arrête pas les suivantes) :
 * - parties en cours : fin de partie restée en attente retentée en D1 ;
 * - tables inactives depuis 7 jours (tous statuts) : partie puis table supprimées ; si la partie
 *   ne peut pas être supprimée, la table est gardée pour réessayer au passage suivant.
 * Renvoie le nombre de tables supprimées.
 */
export async function cleanupStale(env: CleanupEnv, now: Date): Promise<number> {
  const { data: playing, error: playingError } = await playingTables(env.DB)
  if (playingError !== null) console.error('Nettoyage : tables en cours illisibles', playingError)
  for (const id of playing ?? []) {
    try {
      const res = await stub(env, id).fetch(`https://game/tables/${id}/sync`, { method: 'POST' })
      if (!res.ok) console.error(`Nettoyage : synchronisation de ${id} refusée (${res.status})`)
    } catch (e) {
      console.error(`Nettoyage : synchronisation de ${id} impossible`, e)
    }
  }

  const { data: ids, error } = await staleTables(env.DB, new Date(now.getTime() - STALE_AFTER_MS))
  if (error !== null) throw new Error(error)
  let deleted = 0
  for (const id of ids) {
    try {
      const res = await stub(env, id).fetch(`https://game/tables/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`statut ${res.status}`)
      const { error: dbError } = await deleteTable(env.DB, id)
      if (dbError !== null) throw new Error(dbError)
      deleted++
    } catch (e) {
      console.error(`Nettoyage : table ${id} non supprimée`, e)
    }
  }
  return deleted
}
