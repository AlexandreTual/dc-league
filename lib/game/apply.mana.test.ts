import { describe, it, expect } from 'vitest'
import { run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { canApply } from './rules'
import { viewFor } from './view'
import { NO_MANA, type GameAction, type GameState } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const keepAll = (n: number) => Array.from({ length: n }, (_, i) => ({ type: 'keep', actor: `p${i + 1}` }) as GameAction)
const game = (n = 3) => apply(run(setupFor('commander', n), start(1)), ...keepAll(n))
/** Passe le tour du joueur actif (l'ordre du tour est tiré au sort au départ). */
const endTurn = (s: GameState) => applyAction(s, { type: 'endTurn', actor: s.activePlayer })
const mana = (actor: string, color: 'W' | 'U' | 'B' | 'R' | 'G' | 'C', delta: number): GameAction => ({ type: 'mana', actor, color, delta })

describe('réserve de mana', () => {
  it('vide au départ, sans option de garde', () => {
    const s = game()
    expect(s.players.p1.mana).toEqual(NO_MANA)
    expect(NO_MANA).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 })
    expect(s.players.p1.keepMana).toBe(false)
  })

  it('+1, +5, −1, jamais en dessous de 0, sans ligne de journal', () => {
    const before = game()
    let s = apply(before, mana('p1', 'G', 1), mana('p1', 'G', 5), mana('p1', 'G', -1), mana('p1', 'C', 2))
    expect(s.players.p1.mana).toEqual({ ...NO_MANA, G: 5, C: 2 })
    s = apply(s, mana('p1', 'C', -5))
    expect(s.players.p1.mana.C).toBe(0)
    expect(s.players.p2.mana).toEqual(NO_MANA)
    expect(s.log).toHaveLength(before.log.length)
  })

  it('« Vider » remet tout à zéro', () => {
    const s = apply(game(), mana('p1', 'R', 3), mana('p1', 'U', 1), { type: 'clearMana', actor: 'p1' })
    expect(s.players.p1.mana).toEqual(NO_MANA)
  })

  it('passage de tour : toutes les réserves se vident', () => {
    const s = endTurn(apply(game(), mana('p1', 'G', 2), mana('p2', 'B', 1)))
    expect(s.players.p1.mana).toEqual(NO_MANA)
    expect(s.players.p2.mana).toEqual(NO_MANA)
  })

  it('option « garder » : la réserve du joueur passe le tour, avec le journal', () => {
    let s = apply(game(), { type: 'toggleKeepMana', actor: 'p2' })
    expect(s.players.p2.keepMana).toBe(true)
    expect(s.log.at(-1)?.text).toBe('garde sa réserve de mana d’un tour à l’autre')
    s = endTurn(endTurn(apply(s, mana('p1', 'G', 2), mana('p2', 'B', 3))))
    expect(s.players.p1.mana).toEqual(NO_MANA)
    expect(s.players.p2.mana).toEqual({ ...NO_MANA, B: 3 })
    s = apply(s, { type: 'toggleKeepMana', actor: 'p2' })
    expect(s.players.p2.keepMana).toBe(false)
    expect(s.log.at(-1)?.text).toBe('ne garde plus sa réserve de mana')
  })

  it('réserve publique : visible des autres joueurs et des spectateurs', () => {
    const s = apply(game(), mana('p1', 'W', 2), { type: 'toggleKeepMana', actor: 'p1' })
    for (const viewer of ['p1', 'p2', '']) {
      expect(viewFor(s, viewer).players.p1.mana).toEqual({ ...NO_MANA, W: 2 })
      expect(viewFor(s, viewer).players.p1.keepMana).toBe(true)
    }
  })

  it('refusé à un joueur éliminé, ou avec une couleur ou une valeur invalide', () => {
    const s = apply(game(), { type: 'eliminate', actor: 'p2', target: 'p2' })
    expect(canApply(s, mana('p2', 'G', 1))).not.toBeNull()
    expect(canApply(s, mana('p1', 'G', 1))).toBeNull()
    expect(canApply(s, { type: 'mana', actor: 'p1', color: 'X' as 'G', delta: 1 })).not.toBeNull()
    expect(canApply(s, mana('p1', 'G', 1.5))).not.toBeNull()
  })
})
