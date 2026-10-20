import { finishedGamesToArchive, markGameArchived, playingTables, staleTables } from '../../lib/db-games'
import { destroyGame } from '../../lib/games/binding'
import { removeTable } from '../../lib/games/remove'

/** Durée sans activité au-delà de laquelle une table est supprimée (ou, finie, sa partie archivée). */
export const STALE_AFTER_MS = 7 * 24 * 3600 * 1000

type CleanupEnv = { DB: D1Database; GAME: DurableObjectNamespace }

const stub = (env: CleanupEnv, id: string) => env.GAME.get(env.GAME.idFromName(id))

/**
 * Nettoyage périodique, table par table (l'échec de l'une n'arrête pas les suivantes) :
 * - parties en cours : fin de partie restée en attente retentée en D1 ;
 * - tables non terminées inactives depuis 7 jours : partie puis table supprimées ; si la partie
 *   ne peut pas être supprimée, la table est gardée pour réessayer au passage suivant ;
 * - parties finies inactives depuis 7 jours : seul l'état du Durable Object est effacé, la table et
 *   ses places restent en D1 comme historique (vainqueur, durée, decks) ; réessayé si l'effacement échoue.
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

  const before = new Date(now.getTime() - STALE_AFTER_MS)
  const { data: ids, error } = await staleTables(env.DB, before)
  if (error !== null) throw new Error(error)
  const destroy = destroyGame(env)
  let deleted = 0
  for (const id of ids) {
    const { error: removeError } = await removeTable(env.DB, destroy, id)
    if (removeError === null) deleted++
    else console.error(`Nettoyage : table ${id} non supprimée`, removeError)
  }

  const { data: finished, error: finishedError } = await finishedGamesToArchive(env.DB, before)
  if (finishedError !== null) console.error('Nettoyage : parties finies illisibles', finishedError)
  for (const id of finished ?? []) {
    try {
      if (!(await destroy(id))) {
        console.error(`Nettoyage : partie finie ${id} non effacée`)
        continue
      }
      const { error: markError } = await markGameArchived(env.DB, id, now)
      if (markError !== null) console.error(`Nettoyage : partie finie ${id} non notée archivée`, markError)
    } catch (e) {
      console.error(`Nettoyage : partie finie ${id} non effacée`, e)
    }
  }
  return deleted
}
