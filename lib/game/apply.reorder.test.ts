import { describe, it, expect } from 'vitest'
import { run, setupFor, start } from '@/test/game-fixtures'
import { applyAction, cardName } from './apply'
import { canApply, isVisibleTo } from './rules'
import type { GameAction, GameState } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const game = () => run(setupFor('commander', 3), start(1))
const look = (actor: string, target: string, count: number): GameAction => ({ type: 'look', actor, target, count })

describe('reorderTop', () => {
  it('remet les cartes regardées dans l’ordre choisi, sans changer le reste', () => {
    const s0 = applyAction(game(), look('p1', 'p1', 3))
    const [a, b, c, ...rest] = s0.players.p1.zones.library
    const s = applyAction(s0, { type: 'reorderTop', actor: 'p1', target: 'p1', ids: [c, a, b] })
    expect(s.players.p1.zones.library).toEqual([c, a, b, ...rest])
    expect([a, b, c].every((id) => isVisibleTo(s, id, 'p1'))).toBe(true)
  })

  it('journal public sans nom de carte', () => {
    const s0 = applyAction(game(), look('p1', 'p2', 2))
    const [a, b] = s0.players.p2.zones.library
    const s = applyAction(s0, { type: 'reorderTop', actor: 'p1', target: 'p2', ids: [b, a] })
    const line = s.log.at(-1)!
    expect(line).toMatchObject({ actor: 'p1', text: 'remet les 2 cartes du dessus de la bibliothèque de Bob dans l’ordre de son choix', visibleTo: 'all' })
    expect(line.text).not.toContain(cardName(s, a))
    const own = apply(game(), look('p1', 'p1', 2))
    const [x, y] = own.players.p1.zones.library
    expect(applyAction(own, { type: 'reorderTop', actor: 'p1', target: 'p1', ids: [y, x] }).log.at(-1)?.text)
      .toBe('remet les 2 cartes du dessus de sa bibliothèque dans l’ordre de son choix')
  })

  it('les cartes échangent leurs places, même si l’une a été mise dessous entre-temps', () => {
    let s = applyAction(game(), look('p1', 'p1', 3))
    const [a, b, c] = s.players.p1.zones.library
    s = applyAction(s, { type: 'move', actor: 'p1', id: a, to: { player: 'p1', zone: 'library' }, position: 'bottom' })
    s = applyAction(s, { type: 'reorderTop', actor: 'p1', target: 'p1', ids: [c, b] })
    expect(s.players.p1.zones.library.slice(0, 2)).toEqual([c, b])
    expect(s.players.p1.zones.library.at(-1)).toBe(a)
  })

  it('refuse sans regard en cours, avec une carte inconnue, absente ou en double', () => {
    const s0 = game()
    const [a, b, c] = s0.players.p2.zones.library
    const notLooking: GameAction = { type: 'reorderTop', actor: 'p1', target: 'p2', ids: [b, a] }
    expect(canApply(s0, notLooking)).toBe('Tu ne regardes pas cette bibliothèque')
    const s = applyAction(s0, look('p1', 'p2', 2))
    expect(applyAction(s, notLooking)).not.toBe(s)
    expect(canApply(s, { type: 'reorderTop', actor: 'p1', target: 'p2', ids: [c, a] })).toBe('Cette carte est cachée')
    expect(canApply(s, { type: 'reorderTop', actor: 'p1', target: 'p2', ids: [a, a] })).toBe('Carte introuvable')
    expect(canApply(s, { type: 'reorderTop', actor: 'p1', target: 'p2', ids: [s.players.p1.zones.hand[0], a] })).toBe('Carte introuvable')
    expect(canApply(s, { type: 'reorderTop', actor: 'p3', target: 'p2', ids: [b, a] })).toBe('Tu ne regardes pas cette bibliothèque')
  })
})
