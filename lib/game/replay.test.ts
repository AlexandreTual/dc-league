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

describe('GameHistory (cas repris du mode solo)', () => {
  const one = setupFor('commander', 1)
  const soldier = { name: 'Soldat', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1', colors: [], image: null }

  it('peut reprendre depuis une liste d’actions', () => {
    const list = actions()
    expect(new GameHistory(setup, list).state).toEqual(replay(setup, list))
  })

  it('annuler un mulligan redonne la même main', () => {
    const h = new GameHistory(one, [start(4)])
    const hand = h.state.players.p1.zones.hand
    h.push({ type: 'mulligan', actor: 'p1', seed: 99 })
    expect(h.state.players.p1.zones.hand).not.toEqual(hand)
    h.undo('p1')
    expect(h.state.players.p1.zones.hand).toEqual(hand)
  })

  it('annuler la disparition d’un jeton le fait revenir à l’identique', () => {
    const h = new GameHistory(one, [start(4), { type: 'createToken', actor: 'p1', token: soldier, x: 12, y: 34 }])
    h.push({ type: 'move', actor: 'p1', id: 't1', to: { player: 'p1', zone: 'hand' } })
    expect(h.state.cards.t1).toBeUndefined()
    h.undo('p1')
    expect(h.state.players.p1.zones.battlefield).toContain('t1')
    expect(h.state.cards.t1).toMatchObject({ x: 12, y: 34, token: soldier })
  })
})
