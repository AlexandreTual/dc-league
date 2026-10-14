import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { groupBattlefield } from './battlefield'
import { viewFor } from './view'
import type { GameAction, GameState } from './types'

const apply = (s: GameState, ...a: GameAction[]) => a.reduce(applyAction, s)
const forests = (s: GameState) => Object.keys(s.cards).filter((id) => id.startsWith('p1:c3-'))
const onField = (s: GameState, ...ids: string[]) => place(s, ids.map((id) => ({ id, player: 'p1', zone: 'battlefield' as const })))
const rows = (s: GameState, viewer = 'p2') => groupBattlefield(viewFor(s, viewer).players.p1.zones.battlefield, s.catalogs)
const names = (stacks: { cards: { ref: number | null }[]; count: number }[]) => stacks.map((st) => [st.cards[0].ref, st.count])

describe('groupBattlefield', () => {
  it('classe créatures, autres permanents et terrains', () => {
    const s = onField(run(setupFor('commander', 2), start(1)), card('p1', 4), card('p1', 2), forests(run(setupFor('commander', 2), start(1)))[0])
    const r = rows(s)
    expect(names(r.creatures)).toEqual([[4, 1]])
    expect(names(r.others)).toEqual([[2, 1]])
    expect(names(r.lands)).toEqual([[3, 1]])
    expect(r.hidden).toBe(0)
  })

  it('empile les cartes identiques dans le même état, pas les autres', () => {
    const base = run(setupFor('commander', 2), start(1))
    const [f1, f2, f3, f4] = forests(base)
    let s = onField(base, f1, f2, f3, f4)
    expect(names(rows(s).lands)).toEqual([[3, 4]])
    s = apply(s, { type: 'tap', actor: 'p1', id: f2 })
    expect(names(rows(s).lands)).toEqual([[3, 3], [3, 1]])
    s = apply(s, { type: 'counter', actor: 'p1', id: f3, kind: 'plus', delta: 1 })
    expect(rows(s).lands.map((st) => st.count)).toEqual([2, 1, 1])
    s = apply(s, { type: 'pt', actor: 'p1', id: f4, power: 1, toughness: 1 })
    expect(rows(s).lands.map((st) => st.count)).toEqual([1, 1, 1, 1])
  })

  it('jeton selon sa ligne de type, carte face cachée dans les autres permanents', () => {
    let s = onField(run(setupFor('commander', 2), start(1)), card('p1', 4))
    s = apply(s,
      { type: 'createToken', actor: 'p1', token: { name: 'Soldat', typeLine: 'Token Creature — Soldat', power: '1', toughness: '1', colors: [], image: null }, x: 10, y: 10 },
      { type: 'faceDown', actor: 'p1', id: card('p1', 4) })
    const mine = rows(s, 'p1')
    expect(mine.creatures.map((st) => st.cards[0].token?.name)).toEqual(['Soldat'])
    expect(mine.others.map((st) => st.cards[0].faceDown)).toEqual([true])
    const theirs = rows(s, 'p2')
    expect(theirs.hidden).toBe(1)
  })

  it('garde l’ordre d’arrivée', () => {
    const s = onField(run(setupFor('commander', 2), start(1)), card('p1', 2), card('p1', 4), card('p1', 1))
    expect(rows(s).creatures.map((st) => st.cards[0].ref)).toEqual([4, 1])
  })
})
