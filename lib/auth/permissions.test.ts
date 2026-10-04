import { describe, it, expect } from 'vitest'
import { canEditDeck, canCreateDeckFor } from './permissions'

describe('canEditDeck', () => {
  it('autorise le propriétaire', () => {
    expect(canEditDeck({ isAdmin: false, playerId: 'p1' }, { player_id: 'p1' })).toBe(true)
  })
  it("refuse le deck d'un autre", () => {
    expect(canEditDeck({ isAdmin: false, playerId: 'p1' }, { player_id: 'p2' })).toBe(false)
  })
  it("autorise l'admin", () => {
    expect(canEditDeck({ isAdmin: true, playerId: 'p1' }, { player_id: 'p2' })).toBe(true)
  })
})

describe('canCreateDeckFor', () => {
  it('autorise pour soi', () => expect(canCreateDeckFor({ isAdmin: false, playerId: 'p1' }, 'p1')).toBe(true))
  it('refuse pour un autre', () => expect(canCreateDeckFor({ isAdmin: false, playerId: 'p1' }, 'p2')).toBe(false))
  it("autorise l'admin", () => expect(canCreateDeckFor({ isAdmin: true, playerId: 'p1' }, 'p2')).toBe(true))
})
