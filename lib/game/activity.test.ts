import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { diffViews } from './activity'
import { VIEW_LOG_LIMIT, viewFor } from './view'
import type { GameAction, GameState } from './types'

const game = () => place(run(setupFor('commander', 2), start(1)), [{ id: card('p2', 2), player: 'p2', zone: 'battlefield' }])
const step = (s: GameState, a: GameAction, me = 'p1') => {
  const next = applyAction(s, a)
  return { next, diff: diffViews(viewFor(s, me), viewFor(next, me), me) }
}

describe('diffViews', () => {
  it('première vue : rien', () => {
    expect(diffViews(null, viewFor(game(), 'p1'), 'p1')).toEqual({ changed: [], lines: [] })
  })

  it('carte jouée par un autre : changée, avec la ligne du journal', () => {
    const s = game()
    const id = s.players.p2.zones.hand[0]
    const { diff } = step(s, { type: 'move', actor: 'p2', id, to: { player: 'p2', zone: 'battlefield' } })
    expect(diff.changed).toEqual([id])
    expect(diff.lines).toHaveLength(1)
    expect(diff.lines[0].actor).toBe('p2')
  })

  it('engagement, marqueur et retournement sont des changements', () => {
    const s = game()
    expect(step(s, { type: 'tap', actor: 'p2', id: card('p2', 2) }).diff.changed).toEqual([card('p2', 2)])
    expect(step(s, { type: 'counter', actor: 'p2', id: card('p2', 2), kind: 'plus', delta: 1 }).diff.changed).toEqual([card('p2', 2)])
    const delver = place(s, [{ id: card('p2', 4), player: 'p2', zone: 'battlefield' }])
    expect(step(delver, { type: 'flip', actor: 'p2', id: card('p2', 4) }).diff.changed).toEqual([card('p2', 4)])
  })

  it('mes propres actions : cartes changées, mais pas de ligne', () => {
    const s = game()
    const { diff } = step(s, { type: 'draw', actor: 'p1', count: 1 })
    expect(diff.lines).toEqual([])
    expect(diff.changed).toHaveLength(1)
  })

  it('une carte qui disparaît (annulation, jeton) n’est pas signalée', () => {
    const s = applyAction(game(), { type: 'createToken', actor: 'p2', token: { name: 'Soldat', typeLine: 'Token Creature', power: '1', toughness: '1', colors: [], image: null }, x: 0, y: 0 })
    const { diff } = step(s, { type: 'move', actor: 'p2', id: 't1', to: { player: 'p2', zone: 'graveyard' } })
    expect(diff.changed).toEqual([])
  })

  it('spectateur : toutes les lignes', () => {
    const s = game()
    const next = applyAction(s, { type: 'draw', actor: 'p1', count: 1 })
    expect(diffViews(viewFor(s, ''), viewFor(next, ''), null).lines).toHaveLength(1)
  })

  it('journal tronqué : les nouvelles lignes sont trouvées malgré une longueur constante', () => {
    const line = (i: number) => ({ turn: 1, actor: 'p2', text: `ligne ${i}`, visibleTo: 'all' as const })
    const long = { ...game(), log: Array.from({ length: VIEW_LOG_LIMIT + 5 }, (_, i) => line(i)) }
    const next = { ...long, log: [...long.log, line(900), line(901)] }
    const prev = viewFor(long, 'p1')
    const after = viewFor(next, 'p1')
    expect(after.log).toHaveLength(prev.log.length)
    expect(diffViews(prev, after, 'p1').lines.map((l) => l.text)).toEqual(['ligne 900', 'ligne 901'])
    expect(diffViews(after, prev, 'p1').lines).toEqual([])
  })
})
