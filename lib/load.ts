/** Vrai si au moins une des requêtes D1 d'une page a renvoyé une erreur. */
export function loadFailed(...results: { data?: unknown; error?: string | null }[]): boolean {
  return results.some((r) => r.error != null)
}
