// Journal des erreurs de production (table error_log, migration 0020), lu dans l'administration.
import type { Result } from './db'

/** Nombre de lignes gardées : chaque écriture efface les plus anciennes au-delà. */
export const ERROR_LOG_MAX = 200
/** Longueur maximale d'un message, d'un chemin ou d'un code (texte venu du navigateur). */
export const ERROR_FIELD_MAX = 1000

export type ErrorSource = 'navigateur' | 'serveur' | 'nettoyage'

export type ErrorEntry = {
  source: ErrorSource
  message: string
  digest?: string | null
  path?: string | null
  userId?: string | null
}

/** userName : nom du joueur du compte (null si visiteur ou compte supprimé). */
export type LoggedError = Required<ErrorEntry> & { id: number; at: string; userName: string | null }

const clip = (text: string | null | undefined) => (text ? text.slice(0, ERROR_FIELD_MAX) : null)

/** Ajoute une erreur et efface les plus anciennes au-delà de ERROR_LOG_MAX. */
export async function recordError(db: D1Database, entry: ErrorEntry, now: Date): Promise<Result<true>> {
  try {
    await db.batch([
      db
        .prepare('INSERT INTO error_log (at, source, message, digest, path, user_id) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(now.toISOString(), entry.source, clip(entry.message) ?? '', clip(entry.digest), clip(entry.path), entry.userId ?? null),
      db.prepare('DELETE FROM error_log WHERE id <= (SELECT MAX(id) FROM error_log) - ?').bind(ERROR_LOG_MAX),
    ])
    return { data: true, error: null }
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }
}

/** Dernières erreurs, la plus récente d'abord. */
export async function listErrors(db: D1Database, limit = 50): Promise<Result<LoggedError[]>> {
  try {
    const { results } = await db
      .prepare(
        `SELECT e.id, e.at, e.source, e.message, e.digest, e.path, e.user_id AS userId, p.name AS userName
         FROM error_log e LEFT JOIN users u ON u.id = e.user_id LEFT JOIN players p ON p.id = u.player_id
         ORDER BY e.id DESC LIMIT ?`,
      )
      .bind(limit)
      .all<LoggedError>()
    return { data: results, error: null }
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }
}

/** Vide le journal. */
export async function clearErrors(db: D1Database): Promise<Result<true>> {
  try {
    await db.prepare('DELETE FROM error_log').run()
    return { data: true, error: null }
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }
}
