import { describe, expect, it } from 'vitest'
import { run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from '@/lib/game/apply'
import type { GameState } from '@/lib/game/types'
import { keepsHand } from './useLocalSource'

const mull = (s: GameState, seed: number) => applyAction(s, { type: 'mulligan', actor: 'p1', seed })
const bottom = (id: string) => ({ type: 'move' as const, id, to: { player: 'p1', zone: 'library' as const }, position: 'bottom' as const })

describe('keepsHand (mode test)', () => {
  const fresh = run(setupFor('commander', 1), start(1))

  it('mulligan et « Garder » ne gardent pas la main implicitement', () => {
    expect(keepsHand({ type: 'mulligan' }, fresh, 'p1')).toBe(false)
    expect(keepsHand({ type: 'keep' }, fresh, 'p1')).toBe(false)
  })

  it('carte de la main mise au-dessous alors qu’elle est due : la main n’est pas encore gardée', () => {
    const s = mull(mull(fresh, 1), 2)
    expect(keepsHand(bottom(s.players.p1.zones.hand[0]), s, 'p1')).toBe(false)
  })

  it('mise au-dessous sans dette (main de départ) : garde la main comme toute autre action', () => {
    expect(keepsHand(bottom(fresh.players.p1.zones.hand[0]), fresh, 'p1')).toBe(true)
  })

  it('toute autre action garde la main de départ', () => {
    const s = mull(mull(fresh, 1), 2)
    const id = s.players.p1.zones.hand[0]
    expect(keepsHand({ type: 'draw', count: 1 }, s, 'p1')).toBe(true)
    expect(keepsHand({ type: 'move', id, to: { player: 'p1', zone: 'battlefield' }, x: 50, y: 50 }, s, 'p1')).toBe(true)
    expect(keepsHand({ type: 'move', id, to: { player: 'p1', zone: 'library' }, position: 'top' }, s, 'p1')).toBe(true)
  })
})
