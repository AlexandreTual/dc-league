// Erreurs signalées par les navigateurs (POST /api/errors, ouvert aux visiteurs) : limite par adresse IP.
import type { Result } from './db'
import { countRecentFailures, recordAttempt } from './db-auth'
import { recordError, type ErrorEntry } from './db-errors'

/** Signalements acceptés par adresse IP en 15 minutes (fenêtre du compteur de tentatives). */
export const MAX_REPORTS_PER_IP = 20

const ipKey = (ip: string) => `errors-ip:${ip.slice(0, 64)}`

/**
 * Enregistre l'erreur d'un navigateur ; `false` si l'adresse a dépassé sa limite (rien n'est alors écrit).
 * Le compteur est lu avant d'écrire : une rafale ne coûte que des lectures, et ne chasse pas les vraies
 * erreurs du journal. `ip` : `CF-Connecting-IP`, absente en local (pas de limite).
 */
export async function saveClientError(db: D1Database, entry: ErrorEntry, ip: string | null, now: Date): Promise<Result<boolean>> {
  if (ip) {
    const key = ipKey(ip)
    const recent = await countRecentFailures(db, key, now)
    if (recent.error !== null) return { data: null, error: recent.error }
    if (recent.data >= MAX_REPORTS_PER_IP) return { data: false, error: null }
    const counted = await recordAttempt(db, [key], now)
    if (counted.error !== null) return { data: null, error: counted.error }
  }
  const saved = await recordError(db, entry, now)
  return saved.error !== null ? { data: null, error: saved.error } : { data: true, error: null }
}
