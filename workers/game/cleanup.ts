import { finishedGamesToArchive, markGameArchived, playingTables, staleTables } from '../../lib/db-games'
import { destroyGame } from '../../lib/games/binding'
import { removeTable } from '../../lib/games/remove'
import { recordError } from '../../lib/db-errors'

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
 * Renvoie le nombre de tables supprimées. Les échecs sont journalisés un à un (Workers Logs) puis
 * résumés en une ligne du journal des erreurs de l'administration.
 */
export async function cleanupStale(env: CleanupEnv, now: Date): Promise<number> {
  const problems: string[] = []
  const fail = (message: string, detail?: unknown) => {
    if (detail === undefined) console.error(message)
    else console.error(message, detail)
    problems.push(detail === undefined ? message : `${message} (${detail instanceof Error ? detail.message : String(detail)})`)
  }
  try {
    return await cleanup(env, now, fail)
  } catch (e) {
    fail('Nettoyage : arrêté', e)
    throw e
  } finally {
    if (problems.length > 0) {
      const message = `${problems.length} échec(s) : ${problems.join(' ; ')}`
      const { error } = await recordError(env.DB, { source: 'nettoyage', message }, now)
      if (error !== null) console.error('Nettoyage : journal des erreurs indisponible', error)
    }
  }
}

async function cleanup(env: CleanupEnv, now: Date, fail: (message: string, detail?: unknown) => void): Promise<number> {
  const { data: playing, error: playingError } = await playingTables(env.DB)
  if (playingError !== null) fail('Nettoyage : tables en cours illisibles', playingError)
  for (const id of playing ?? []) {
    try {
      const res = await stub(env, id).fetch(`https://game/tables/${id}/sync`, { method: 'POST' })
      if (!res.ok) fail(`Nettoyage : synchronisation de ${id} refusée (${res.status})`)
    } catch (e) {
      fail(`Nettoyage : synchronisation de ${id} impossible`, e)
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
    else fail(`Nettoyage : table ${id} non supprimée`, removeError)
  }

  const { data: finished, error: finishedError } = await finishedGamesToArchive(env.DB, before)
  if (finishedError !== null) fail('Nettoyage : parties finies illisibles', finishedError)
  for (const id of finished ?? []) {
    try {
      if (!(await destroy(id))) {
        fail(`Nettoyage : partie finie ${id} non effacée`)
        continue
      }
      const { error: markError } = await markGameArchived(env.DB, id, now)
      if (markError !== null) fail(`Nettoyage : partie finie ${id} non notée archivée`, markError)
    } catch (e) {
      fail(`Nettoyage : partie finie ${id} non effacée`, e)
    }
  }
  return deleted
}
