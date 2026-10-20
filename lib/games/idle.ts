import type { Messages } from '@/lib/i18n/messages'

/** Au-delà de cette durée sans activité, l'admin voit la table comme abandonnée. */
export const IDLE_AFTER_MS = 24 * 3600_000

/** Durée écoulée depuis `lastActivityAt` (date SQLite `AAAA-MM-JJ HH:MM:SS`, en UTC). */
export function idleFor(lastActivityAt: string, now: Date): number {
  const at = Date.parse(`${lastActivityAt.replace(' ', 'T')}Z`)
  return Number.isNaN(at) ? 0 : Math.max(0, now.getTime() - at)
}

export function idleLabel(ms: number, t: Messages): string {
  const idle = t.admin.games.idle
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return idle.now
  if (minutes < 60) return idle.minutes(minutes)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return idle.hours(hours)
  return idle.days(Math.floor(hours / 24))
}
