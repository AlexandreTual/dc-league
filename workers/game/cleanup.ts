import { deleteTable, staleTables } from '../../lib/db-games'

/** Durée sans activité au-delà de laquelle une table est supprimée. */
export const STALE_AFTER_MS = 7 * 24 * 3600 * 1000

/** Supprime les tables inactives depuis 7 jours (tous statuts) et leur partie. Renvoie le nombre de tables supprimées. */
export async function cleanupStale(env: { DB: D1Database; GAME: DurableObjectNamespace }, now: Date): Promise<number> {
  const { data: ids, error } = await staleTables(env.DB, new Date(now.getTime() - STALE_AFTER_MS))
  if (error !== null) throw new Error(error)
  let deleted = 0
  for (const id of ids) {
    await env.GAME.get(env.GAME.idFromName(id)).fetch(`https://game/tables/${id}`, { method: 'DELETE' })
    if ((await deleteTable(env.DB, id)).error === null) deleted++
  }
  return deleted
}
