import { describe, it, expect } from 'vitest'
import { IDLE_AFTER_MS, idleFor, idleLabel } from './idle'

const now = new Date('2026-10-14T12:00:00Z')

describe('inactivité d’une table', () => {
  it('durée depuis la dernière activité (date SQLite en UTC)', () => {
    expect(idleFor('2026-10-14 11:30:00', now)).toBe(30 * 60_000)
    expect(idleFor('pas une date', now)).toBe(0)
  })

  it('libellé lisible', () => {
    expect(idleLabel(30_000)).toBe('à l’instant')
    expect(idleLabel(5 * 60_000)).toBe('il y a 5 min')
    expect(idleLabel(3 * 3600_000 + 59 * 60_000)).toBe('il y a 3 h')
    expect(idleLabel(2 * 86_400_000 + 3600_000)).toBe('il y a 2 j')
  })

  it('abandonnée au-delà de 24 h', () => {
    expect(IDLE_AFTER_MS).toBe(24 * 3600_000)
  })
})
