import { describe, expect, it } from 'vitest'
import { keepsHand, SOLO } from './useLocalSource'

describe('keepsHand (mode test)', () => {
  it('mulligan, garder et mise au-dessous ne gardent pas la main implicitement', () => {
    expect(keepsHand({ type: 'mulligan' })).toBe(false)
    expect(keepsHand({ type: 'keep' })).toBe(false)
    expect(keepsHand({ type: 'move', id: 'x', to: { player: SOLO, zone: 'library' }, position: 'bottom' })).toBe(false)
  })

  it('toute autre action garde la main de départ', () => {
    expect(keepsHand({ type: 'draw', count: 1 })).toBe(true)
    expect(keepsHand({ type: 'move', id: 'x', to: { player: SOLO, zone: 'battlefield' }, x: 50, y: 50 })).toBe(true)
    expect(keepsHand({ type: 'move', id: 'x', to: { player: SOLO, zone: 'library' }, position: 'top' })).toBe(true)
  })
})
