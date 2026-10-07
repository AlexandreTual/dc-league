import { describe, it, expect } from 'vitest'
import { run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import type { GameAction, GameState } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)

/** Partie à 3 joueurs démarrée à l'instant 1000, mains gardées. */
function started(): GameState {
  const s = run(setupFor('commander', 3), { ...start(1), at: 1000 })
  return apply(s, ...s.turnOrder.map((p) => ({ type: 'keep', actor: p }) as GameAction))
}

describe('minuteur', () => {
  it('début de partie et du premier tour à l’instant du start', () => {
    const s = started()
    expect(s).toMatchObject({ startedAt: 1000, turnStartedAt: 1000, playTime: {} })
  })

  it('cumule le temps de chaque joueur à chaque fin de tour', () => {
    let s = started()
    const [a, b, c] = s.turnOrder
    s = apply(s, { type: 'endTurn', actor: a, at: 5000 }, { type: 'endTurn', actor: b, at: 6000 })
    expect(s.turnStartedAt).toBe(6000)
    expect(s.playTime).toEqual({ [a]: 4000, [b]: 1000 })
    s = apply(s, { type: 'endTurn', actor: c, at: 9000 }, { type: 'endTurn', actor: a, at: 10_000 })
    expect(s.playTime).toEqual({ [a]: 5000, [b]: 1000, [c]: 3000 })
    expect(s.startedAt).toBe(1000)
  })

  it('l’élimination du joueur actif termine son tour', () => {
    let s = started()
    const [a, b] = s.turnOrder
    s = apply(s, { type: 'eliminate', actor: a, target: a, at: 3000 })
    expect(s.activePlayer).toBe(b)
    expect(s.turnStartedAt).toBe(3000)
    expect(s.playTime).toEqual({ [a]: 2000 })
  })

  it('l’élimination d’un autre joueur ne touche pas au tour', () => {
    let s = started()
    const [a, , c] = s.turnOrder
    s = apply(s, { type: 'eliminate', actor: c, target: c, at: 3000 })
    expect(s.activePlayer).toBe(a)
    expect(s.turnStartedAt).toBe(1000)
  })

  it('rien sans horodatage (mode test, anciennes parties)', () => {
    const s = run(setupFor('commander', 2), start(1))
    const next = apply(s, { type: 'keep', actor: s.turnOrder[0] }, { type: 'keep', actor: s.turnOrder[1] }, { type: 'endTurn', actor: s.turnOrder[0] })
    expect(next).not.toHaveProperty('startedAt')
    expect(next).not.toHaveProperty('turnStartedAt')
    expect(next).not.toHaveProperty('playTime')
  })

  it('une ancienne partie sans début horodaté démarre le minuteur du tour au premier tour horodaté', () => {
    let s = run(setupFor('commander', 2), start(1))
    const [a, b] = s.turnOrder
    s = apply(s, { type: 'keep', actor: a }, { type: 'keep', actor: b }, { type: 'endTurn', actor: a, at: 5000 })
    expect(s.startedAt).toBeUndefined()
    expect(s.turnStartedAt).toBe(5000)
    s = apply(s, { type: 'endTurn', actor: b, at: 8000 })
    expect(s.playTime).toEqual({ [b]: 3000 })
  })
})
