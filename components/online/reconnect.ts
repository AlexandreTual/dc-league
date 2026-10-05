// Politique de reconnexion au serveur de jeu, sans navigateur (testable).

/** Délais de reconnexion successifs (ms) ; le dernier se répète. Remis à zéro après une connexion réussie. */
export const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000]

/** Durée sans connexion au-delà de laquelle on cesse de réessayer. */
export const GIVE_UP_AFTER_MS = 60_000

export const SOCKET_MSG = {
  gone: "Cette partie n'existe plus",
  unreachable: 'Connexion au serveur de jeu impossible',
  offline: 'Connexion perdue, action non envoyée',
}

/** Raisons de fermeture envoyées par le serveur de jeu quand la partie n'existe pas ou plus. */
const DEFINITIVE_REASONS = ['Table supprimée', 'Partie introuvable']

export type NextStep = { retryIn: number } | { giveUp: string }

/**
 * Que faire après la fermeture de la connexion : réessayer après un délai, ou abandonner avec un message
 * (partie supprimée ou introuvable, ou plus d'une minute sans connexion).
 * `lostSince` : instant de la première fermeture depuis la dernière connexion réussie ; `attempt` : essais déjà faits.
 */
export function nextStep(close: { reason: string; tableGone: boolean }, lostSince: number, attempt: number, now: number): NextStep {
  if (close.tableGone || DEFINITIVE_REASONS.includes(close.reason)) return { giveUp: SOCKET_MSG.gone }
  if (now - lostSince >= GIVE_UP_AFTER_MS) return { giveUp: SOCKET_MSG.unreachable }
  return { retryIn: RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)] }
}
