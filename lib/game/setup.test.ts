import { describe, it, expect } from 'vitest'
import { testDeckCards } from '@/test/factories'
import { buildCatalog } from './catalog'
import { createInitialState } from './setup'

const { catalog } = buildCatalog('d1', testDeckCards())

describe('createInitialState', () => {
  const state = createInitialState(catalog)

  it('crée un exemplaire distinct par unité de quantité', () => {
    const forests = Object.values(state.cards).filter((c) => c.ref === 3).map((c) => c.id)
    expect(forests).toHaveLength(30)
    expect(new Set(forests).size).toBe(30)
    expect(forests).toContain('c3-1')
    expect(forests).toContain('c3-30')
  })

  it('place le commandant en zone de commandement et le reste en bibliothèque', () => {
    expect(state.zones.command).toEqual(['c1-1'])
    expect(state.cards['c1-1'].isCommander).toBe(true)
    expect(state.zones.library).toHaveLength(32)
    expect(state.zones.hand).toEqual([])
    expect(state.zones.battlefield).toEqual([])
  })

  it('initialise les compteurs', () => {
    expect(state).toMatchObject({ life: 40, turn: 1, log: [], nextTokenId: 1, commanderCasts: {} })
    expect(state.stats).toEqual({ drawn: 0, landsPlayed: 0, mulligans: 0 })
    expect(state.cards['c2-1']).toMatchObject({
      tapped: false, flipped: false, faceDown: false, token: null, counters: { plus: 0, minus: 0, other: 0 },
    })
  })
})
