/** Au-delà de cette durée sans activité, l'admin voit la table comme abandonnée. */
export const IDLE_AFTER_MS = 24 * 3600_000

/** Durée écoulée depuis `lastActivityAt` (date SQLite `AAAA-MM-JJ HH:MM:SS`, en UTC). */
export function idleFor(lastActivityAt: string, now: Date): number {
  const at = Date.parse(`${lastActivityAt.replace(' ', 'T')}Z`)
  return Number.isNaN(at) ? 0 : Math.max(0, now.getTime() - at)
}

export function idleLabel(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'à l’instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}
