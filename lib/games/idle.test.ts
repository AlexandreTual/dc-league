import { describe, it, expect } from 'vitest'
import { IDLE_AFTER_MS, idleFor, idleLabel, splitByActivity } from './idle'

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

describe('salon : parties actives et inactives', () => {
  const t = (id: string, lastActivityAt: string) => ({ id, lastActivityAt })

  it('inactive au-delà de 24 h, ordre gardé, temps d’inactivité joint', () => {
    const { active, idle } = splitByActivity([
      t('a', '2026-10-14 11:59:00'), t('b', '2026-10-12 12:00:00'), t('c', '2026-10-13 12:00:00'), t('d', '2026-10-13 11:59:59'),
    ], now)
    expect(active.map((x) => x.id)).toEqual(['a', 'c'])
    expect(idle.map((x) => x.id)).toEqual(['b', 'd'])
    expect(active[0].idleMs).toBe(60_000)
    expect(idleLabel(idle[0].idleMs)).toBe('il y a 2 j')
  })

  it('date illisible : comptée active', () => {
    expect(splitByActivity([t('x', '??')], now).active.map((x) => x.id)).toEqual(['x'])
  })
})
