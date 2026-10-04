import { describe, it, expect } from 'vitest'
import { setupFor, start } from '@/test/game-fixtures'
import { GameHistory, replay } from './replay'
import type { GameAction } from './types'

const setup = setupFor('commander', 2)

/** 45 actions valides : start, deux keep, puis pioches et points de vie alternés. */
function actions(): GameAction[] {
  const list: GameAction[] = [start(1), { type: 'keep', actor: 'p1' }, { type: 'keep', actor: 'p2' }]
  for (let i = 0; list.length < 45; i++) {
    const actor = i % 2 ? 'p2' : 'p1'
    list.push(i % 3 ? { type: 'draw', actor, count: 1 } : { type: 'life', actor, target: 'p1', delta: -1 })
  }
  return list
}

describe('GameHistory', () => {
  it('refuse une action invalide sans l’ajouter', () => {
    const h = new GameHistory(setup, [start(1)])
    const other = h.state.turnOrder[1]
    expect(h.push({ type: 'endTurn', actor: other })).toBe("Ce n'est pas ton tour")
    expect(h.actions).toHaveLength(1)
    expect(h.push({ type: 'draw', actor: 'p1', count: 1 })).toBeNull()
    expect(h.actions).toHaveLength(2)
  })

  it('état égal au rejeu, y compris après annulation autour des snapshots', () => {
    const all = actions()
    for (const n of [19, 20, 21, 41]) {
      expect(new GameHistory(setup, all.slice(0, n)).state).toEqual(replay(setup, all.slice(0, n)))
      const h = new GameHistory(setup, all.slice(0, n + 1))
      expect(h.undo(all[n].actor)).toBe(true)
      expect(h.state).toEqual(replay(setup, all.slice(0, n)))
      expect(h.actions).toHaveLength(n)
    }
  })

  it('annuler : seulement sa propre dernière action, jamais le start', () => {
    const h = new GameHistory(setup, [start(1)])
    expect(h.canUndo('p1')).toBe(false)
    expect(h.undo('p1')).toBe(false)
    h.push({ type: 'draw', actor: 'p1', count: 1 })
    expect(h.canUndo('p1')).toBe(true)
    expect(h.canUndo('p2')).toBe(false)
    h.push({ type: 'life', actor: 'p2', target: 'p2', delta: 1 })
    expect(h.canUndo('p1')).toBe(false)
    expect(h.undo('p1')).toBe(false)
    expect(h.actions).toHaveLength(3)
  })
})
