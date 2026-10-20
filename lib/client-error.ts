// Erreurs affichées par les pages d'erreur (app/error.tsx, app/global-error.tsx), envoyées au journal.
import type { ErrorEntry } from './db-errors'

/** Corps envoyé par le navigateur à POST /api/errors. */
export type ClientErrorReport = { message: string; digest: string | null; path: string }

export function clientErrorReport(error: Error & { digest?: string }, path: string): ClientErrorReport {
  return { message: error.message || error.name || 'Erreur inconnue', digest: error.digest ?? null, path }
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null)

/** Corps reçu (texte libre du navigateur) → ligne du journal, ou null s'il n'a pas de message. */
export function clientErrorEntry(body: Record<string, unknown>, userId: string | null): ErrorEntry | null {
  const message = text(body.message)
  if (!message) return null
  return { source: 'navigateur', message, digest: text(body.digest), path: text(body.path), userId }
}

/** Journalise dans la console et envoie au journal du site ; un échec d'envoi est ignoré. */
export function reportClientError(error: Error & { digest?: string }): void {
  console.error(error)
  try {
    const report = clientErrorReport(error, window.location.pathname + window.location.search)
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Rien à faire : la page d'erreur reste affichée.
  }
}
