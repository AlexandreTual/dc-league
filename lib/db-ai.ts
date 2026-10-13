// Compteur de questions posées à l'assistant IA (table ai_usage, migration 0015).
import type { Result } from './db'

function message(e: unknown): string {
  return (e as Error).message
}

/** Questions déjà posées ce jour-là (0 si aucune). */
export async function getAiUsage(db: D1Database, userId: string, day: string): Promise<Result<number>> {
  try {
    const count = await db.prepare('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?').bind(userId, day).first<number>('count')
    return { data: count ?? 0, error: null }
  } catch (e) {
    return { data: null, error: message(e) }
  }
}

/**
 * Compte une question, en une seule requête (deux onglets ne peuvent pas dépasser le quota).
 * Renvoie le nombre de questions restantes, ou null si le quota est déjà atteint (compteur inchangé).
 */
export async function takeAiQuestion(db: D1Database, userId: string, day: string, quota: number): Promise<Result<number | null>> {
  try {
    const count = await db
      .prepare(
        `INSERT INTO ai_usage (user_id, day, count) VALUES (?1, ?2, 1)
         ON CONFLICT (user_id, day) DO UPDATE SET count = count + 1 WHERE count < ?3
         RETURNING count`,
      )
      .bind(userId, day, quota)
      .first<number>('count')
    return { data: count === null ? null : quota - count, error: null }
  } catch (e) {
    return { data: null, error: message(e) }
  }
}

/** Rend une question (l'IA n'a pas répondu), sans descendre sous 0. */
export async function giveBackAiQuestion(db: D1Database, userId: string, day: string): Promise<Result<true>> {
  try {
    await db.prepare('UPDATE ai_usage SET count = count - 1 WHERE user_id = ? AND day = ? AND count > 0').bind(userId, day).run()
    return { data: true, error: null }
  } catch (e) {
    return { data: null, error: message(e) }
  }
}
