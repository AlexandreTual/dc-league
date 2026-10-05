import { describe, it, expect } from 'vitest'
import { setupFor } from '@/test/game-fixtures'
import { createInitialState } from './setup'

describe('createInitialState', () => {
  it('prépare 4 joueurs en Commander', () => {
    const s = createInitialState(setupFor('commander', 4))
    expect(Object.keys(s.players)).toEqual(['p1', 'p2', 'p3', 'p4'])
    for (const p of Object.values(s.players)) {
      expect(p).toMatchObject({ life: 40, poison: 0, kept: false, mulligans: 0, eliminated: false, topRevealed: false })
      expect(p.zones.library).toHaveLength(32)
      expect(p.zones.command).toEqual([`${p.id}:c1-1`])
      expect(p.zones.hand).toEqual([])
    }
    const forests = Object.keys(s.cards).filter((id) => id.startsWith('p2:c3-'))
    expect(forests).toHaveLength(30)
    expect(forests).toContain('p2:c3-30')
    expect(s.cards['p2:c3-1']).toMatchObject({ owner: 'p2', ref: 3, knownBy: [], token: null })
    expect(s.cards['p3:c1-1'].isCommander).toBe(true)
  })

  it('met 20 points de vie en duel', () => {
    const s = createInitialState(setupFor('duel', 2))
    expect(s.players.p1.life).toBe(20)
    expect(s.format).toBe('duel')
  })

  it('initialise la partie', () => {
    const s = createInitialState(setupFor('commander', 3))
    expect(s).toMatchObject({
      turnOrder: ['p1', 'p2', 'p3'], activePlayer: 'p1', turn: 1, started: false,
      monarch: null, initiative: null, log: [], nextTokenId: 1, commanderCasts: {}, lookingAt: {},
    })
    expect(Object.keys(s.catalogs)).toEqual(['p1', 'p2', 'p3'])
  })
})
