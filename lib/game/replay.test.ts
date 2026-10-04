import { describe, it, expect } from 'vitest'
import { testDeckCards } from '@/test/factories'
import { buildCatalog } from './catalog'
import { createInitialState } from './setup'
import { applyAction } from './apply'
import { GameHistory, replay } from './replay'
import type { GameAction } from './types'

const { catalog } = buildCatalog('d1', testDeckCards())
const soldier = { name: 'Soldat', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1', colors: [], image: null }

/** Suite variée de n actions après start, sans dépendre du contenu de la main. */
function actions(n: number): GameAction[] {
  const pool: GameAction[] = [
    { type: 'draw', count: 1 },
    { type: 'move', id: 'c2-1', to: 'battlefield', x: 30, y: 40 },
    { type: 'tap', id: 'c2-1' },
    { type: 'life', delta: -1 },
    { type: 'move', id: 'c2-1', to: 'graveyard' },
    { type: 'nextTurn' },
    { type: 'shuffle', seed: 5 },
    { type: 'createToken', token: soldier, x: 10, y: 10 },
  ]
  return [{ type: 'start', seed: 3 }, ...Array.from({ length: n }, (_, i) => pool[i % pool.length])]
}

describe('replay', () => {
  it('égale l’application pas à pas', () => {
    const list = actions(10)
    const stepByStep = list.reduce((s, a) => applyAction(s, a, catalog), createInitialState(catalog))
    expect(replay(catalog, list)).toEqual(stepByStep)
  })
})

describe('GameHistory', () => {
  it.each([19, 20, 21, 41, 50])('après %i actions, l’état et l’annulation égalent un rejeu', (n) => {
    const list = actions(n)
    const history = new GameHistory(catalog)
    for (const a of list) history.push(a)
    expect(history.state).toEqual(replay(catalog, list))
    expect(history.undo()).toEqual(replay(catalog, list.slice(0, -1)))
    expect(history.actions).toEqual(list.slice(0, -1))
  })

  it('peut reprendre depuis une liste d’actions', () => {
    const list = actions(25)
    expect(new GameHistory(catalog, list).state).toEqual(replay(catalog, list))
  })

  it('annuler un mulligan redonne la même main', () => {
    const history = new GameHistory(catalog, [{ type: 'start', seed: 4 }])
    const hand = history.state.zones.hand
    history.push({ type: 'mulligan', seed: 99 })
    expect(history.state.zones.hand).not.toEqual(hand)
    expect(history.undo().zones.hand).toEqual(hand)
  })

  it('annuler la disparition d’un jeton le fait revenir à l’identique', () => {
    const history = new GameHistory(catalog, [{ type: 'start', seed: 4 }, { type: 'createToken', token: soldier, x: 12, y: 34 }])
    history.push({ type: 'move', id: 't1', to: 'hand' })
    expect(history.state.cards.t1).toBeUndefined()
    const back = history.undo()
    expect(back.zones.battlefield).toContain('t1')
    expect(back.cards.t1).toMatchObject({ x: 12, y: 34, token: soldier })
  })

  it('ne peut pas annuler le début de partie', () => {
    const history = new GameHistory(catalog, [{ type: 'start', seed: 4 }])
    expect(history.canUndo()).toBe(false)
    const before = history.state
    expect(history.undo()).toBe(before)
    history.push({ type: 'draw', count: 1 })
    expect(history.canUndo()).toBe(true)
  })
})
