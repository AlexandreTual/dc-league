import { describe, it, expect } from 'vitest'
import { formatDuration, toLocalClock } from './clock'

describe('formatDuration', () => {
  it('minutes et secondes, puis heures', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65_400)).toBe('1:05')
    expect(formatDuration(59 * 60_000 + 59_999)).toBe('59:59')
    expect(formatDuration(3600_000 + 2 * 60_000 + 3000)).toBe('1:02:03')
  })

  it('jamais négatif (horloges légèrement décalées)', () => {
    expect(formatDuration(-5000)).toBe('0:00')
  })
})

describe('toLocalClock', () => {
  it('décale les instants du serveur vers l’horloge locale', () => {
    expect(toLocalClock({ now: 10_000, startedAt: 1000, turnStartedAt: 8000 }, 50_000)).toEqual({ startedAt: 41_000, turnStartedAt: 48_000 })
    expect(toLocalClock({ now: 10_000, startedAt: 1000, finishedAt: 9000 }, 10_000)).toEqual({ startedAt: 1000, finishedAt: 9000 })
  })

  it('rien sans minuteur (serveur de jeu plus ancien)', () => {
    expect(toLocalClock(undefined, 0)).toBeUndefined()
  })
})
