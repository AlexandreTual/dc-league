import { describe, it, expect } from 'vitest'
import { run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { diffViews } from './activity'
import { DICE_SIDES, MAX_DICE, rollDice, rollText } from './dice'
import { GameHistory } from './replay'
import { createRoom, handleMessage } from './room'
import { canApply } from './rules'
import { parseClientAction } from './validate'
import { viewFor } from './view'
import type { GameAction } from './types'

const game = () => run(setupFor('commander', 2), start(1))
const roll = (sides: number, count = 1, actor = 'p1', seed: string | number = 'graine'): GameAction =>
  ({ type: 'roll', actor, sides, count, seed })

describe('rollDice', () => {
  it('donne, pour une graine, toujours les mêmes résultats, entre 1 et le nombre de faces', () => {
    for (const sides of DICE_SIDES) {
      const a = rollDice(sides, MAX_DICE, 'abc')
      expect(rollDice(sides, MAX_DICE, 'abc')).toEqual(a)
      expect(a).toHaveLength(MAX_DICE)
      for (const n of a) {
        expect(Number.isInteger(n)).toBe(true)
        expect(n).toBeGreaterThanOrEqual(1)
        expect(n).toBeLessThanOrEqual(sides)
      }
    }
  })

  it('tire toutes les faces d’un d20 sur assez de lancers', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 400; i++) rollDice(20, 1, `g${i}`).forEach((n) => seen.add(n))
    expect(seen.size).toBe(20)
  })
})

describe('rollText', () => {
  it('pile ou face', () => {
    expect(rollText(2, [1])).toBe('Pile ou face : Pile')
    expect(rollText(2, [2])).toBe('Pile ou face : Face')
    expect(rollText(2, [1, 2, 2])).toBe('Lance 3 pièces : Pile, Face, Face')
  })

  it('un dé, puis plusieurs dés avec le total', () => {
    expect(rollText(20, [17])).toBe('Lance un d20 : 17')
    expect(rollText(6, [4, 2, 6])).toBe('Lance 3d6 : 4, 2, 6 (total 12)')
  })
})

describe('action roll', () => {
  it('écrit le résultat dans le journal, visible de tous, sans rien changer d’autre', () => {
    const s = game()
    const next = applyAction(s, roll(6, 3))
    const entry = next.log.at(-1)!
    expect(entry).toMatchObject({ actor: 'p1', visibleTo: 'all', roll: true })
    expect(entry.text).toBe(rollText(6, rollDice(6, 3, 'graine')))
    expect({ ...next, log: s.log }).toEqual(s)
  })

  it('n’importe quel joueur en lice peut lancer, même hors de son tour', () => {
    const s = game()
    expect(canApply(s, roll(20, 1, s.activePlayer === 'p1' ? 'p2' : 'p1'))).toBeNull()
  })

  it('refuse un dé ou un nombre de dés invalide', () => {
    const s = game()
    for (const bad of [roll(7), roll(0), roll(6, 0), roll(6, MAX_DICE + 1), roll(6, 1.5)]) {
      expect(canApply(s, bad)).toBe('Lancer de dés invalide')
    }
  })

  it('refuse un joueur éliminé', () => {
    const s = applyAction(game(), { type: 'eliminate', actor: 'p2', target: 'p2' })
    expect(canApply(s, roll(6, 1, 'p2'))).toBe('Tu es éliminé')
  })

  it('un lancer ne s’annule pas (sinon on pourrait relancer jusqu’au résultat voulu)', () => {
    const h = new GameHistory(setupFor('commander', 2), [start(1)])
    h.push(roll(20))
    expect(h.canUndo('p1')).toBe(false)
    expect(h.undo('p1')).toBe(false)
  })
})

describe('roll en ligne', () => {
  it('validation : faces et nombre de dés bornés, graine du navigateur ignorée', () => {
    expect(parseClientAction({ type: 'roll', sides: 6, count: 3, seed: 'triche' })).toEqual({ type: 'roll', sides: 6, count: 3 })
    expect(parseClientAction({ type: 'roll', sides: 7, count: 1 })).toBe('Action invalide : sides')
    expect(parseClientAction({ type: 'roll', sides: 6, count: MAX_DICE + 1 })).toBe('Action invalide : count')
  })

  it('le serveur tire la graine du lancer', () => {
    const setup = setupFor('commander', 2)
    let n = 0
    const ctx = { now: 0, seed: () => `serveur-${n++}` }
    const room = createRoom('t', setup, 'p1', ctx.seed, 0)
    handleMessage(room, 'p1', { type: 'action', action: { type: 'roll', sides: 20, count: 1 } }, ctx)
    const last = room.history.actions.at(-1)!
    expect(last).toMatchObject({ type: 'roll', actor: 'p1', sides: 20, count: 1 })
    expect(last.type === 'roll' && last.seed).toMatch(/^serveur-/)
  })

  it('la vue garde la marque du lancer, et mon propre lancer s’affiche aussi chez moi', () => {
    const s = game()
    const next = applyAction(s, roll(6, 2))
    expect(viewFor(next, 'p2').log.at(-1)).toMatchObject({ actor: 'p1', roll: true })
    const mine = diffViews(viewFor(s, 'p1'), viewFor(next, 'p1'), 'p1')
    expect(mine.lines).toEqual([{ actor: 'p1', text: next.log.at(-1)!.text, roll: true }])
  })
})
