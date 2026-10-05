import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { isVisibleTo } from './rules'
import type { GameAction, GameState, PlayerZone } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const sol = card('p1', 2)
const game = () => place(run(setupFor('commander', 3), start(1)), [{ id: sol, player: 'p1', zone: 'battlefield' }])
const move = (zone: PlayerZone, faceDown?: boolean): GameAction =>
  ({ type: 'move', actor: 'p1', id: sol, to: { player: 'p1', zone }, ...(faceDown ? { faceDown } : {}) })

describe('état face cachée', () => {
  it('exil face cachée → main → champ de bataille : la carte redevient face visible', () => {
    let s = applyAction(game(), move('exile', true))
    expect(s.cards[sol].faceDown).toBe(true)
    s = applyAction(s, move('hand'))
    expect(s.cards[sol].faceDown).toBe(false)
    s = applyAction(s, move('battlefield'))
    expect(s.cards[sol].faceDown).toBe(false)
    expect(isVisibleTo(s, sol, 'p1')).toBe(true)
    expect(isVisibleTo(s, sol, 'p2')).toBe(true)
  })

  it('exil face cachée → cimetière : la carte est face visible', () => {
    const s = apply(game(), move('exile', true), move('graveyard'))
    expect(s.cards[sol].faceDown).toBe(false)
    expect(isVisibleTo(s, sol, 'p2')).toBe(true)
  })

  it('face cachée seulement sur le champ de bataille ou en exil', () => {
    for (const zone of ['library', 'hand', 'graveyard', 'command'] as const) {
      expect(applyAction(game(), move(zone, true)).cards[sol].faceDown, zone).toBe(false)
    }
    expect(apply(game(), move('exile'), move('exile', true)).cards[sol].faceDown).toBe(true)
  })

  it('exil face cachée → champ de bataille : reste face cachée et connue de qui la connaissait', () => {
    const s = apply(game(), move('exile', true), move('battlefield'))
    expect(s.cards[sol].faceDown).toBe(true)
    expect(isVisibleTo(s, sol, 'p1')).toBe(true)
    expect(isVisibleTo(s, sol, 'p2')).toBe(false)
  })

  it('giveControl d’une carte face cachée : le nouveau contrôleur la connaît', () => {
    let s = applyAction(game(), { type: 'faceDown', actor: 'p1', id: sol })
    expect(isVisibleTo(s, sol, 'p2')).toBe(false)
    s = applyAction(s, { type: 'giveControl', actor: 'p1', id: sol, to: 'p2' })
    expect(s.cards[sol].faceDown).toBe(true)
    expect(isVisibleTo(s, sol, 'p2')).toBe(true)
    expect(isVisibleTo(s, sol, 'p3')).toBe(false)
  })

  it('giveControl d’une carte face visible ne touche pas à knownBy', () => {
    const s = applyAction(game(), { type: 'giveControl', actor: 'p1', id: sol, to: 'p2' })
    expect(s.cards[sol].knownBy).toEqual([])
  })
})
