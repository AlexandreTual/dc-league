// Minuteur des parties en ligne : l'heure de référence vient du serveur, le navigateur ne fait qu'afficher.
import type { GameClock } from './room'

/** Instants du minuteur ramenés à l'horloge du navigateur (ms). */
export type LocalClock = { startedAt?: number; turnStartedAt?: number; finishedAt?: number }

/**
 * Décale les instants du serveur vers l'horloge locale, d'après l'heure du serveur à l'envoi (`clock.now`)
 * et l'heure locale à la réception : tous les joueurs voient la même valeur, même si leurs horloges diffèrent.
 */
export function toLocalClock(clock: GameClock | undefined, receivedAt: number): LocalClock | undefined {
  if (!clock) return undefined
  const shift = (t: number | undefined) => (t === undefined ? undefined : t + receivedAt - clock.now)
  const out: LocalClock = {}
  for (const key of ['startedAt', 'turnStartedAt', 'finishedAt'] as const) {
    const t = shift(clock[key])
    if (t !== undefined) out[key] = t
  }
  return out
}

/** Durée lisible : `m:ss`, ou `h:mm:ss` à partir d'une heure. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}
