import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { canApply } from './rules'
import { viewFor } from './view'
import type { GameAction, GameState } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const lastText = (s: GameState) => s.log.at(-1)?.text
const kenrith = (p: string) => card(p, 1)
const delver = (p: string) => card(p, 4)

function game(): GameState {
  return place(run(setupFor('commander', 3), start(1)), [
    { id: kenrith('p1'), player: 'p1', zone: 'battlefield' },
    { id: delver('p1'), player: 'p1', zone: 'battlefield' },
    { id: delver('p2'), player: 'p2', zone: 'battlefield' },
  ])
}

describe('force et endurance jusqu’à la fin du tour', () => {
  it('tout joueur la modifie, à part de la modification permanente, journal et vue', () => {
    const id = kenrith('p1')
    let s = apply(game(), { type: 'pt', actor: 'p1', id, power: 1, toughness: 0 }, { type: 'ptTurn', actor: 'p2', id, power: 3, toughness: 3 })
    expect(s.cards[id]).toMatchObject({ ptMod: { power: 1, toughness: 0 }, ptTurn: { power: 3, toughness: 3 } })
    expect(s.log.at(-1)).toMatchObject({ actor: 'p2', text: 'Kenrith, the Returned King : 9/8 (+1/+0, +3/+3 ce tour)' })
    expect(viewFor(s, 'p3').players.p1.zones.battlefield.find((c) => !c.hidden && c.id === id)).toMatchObject({ ptTurn: { power: 3, toughness: 3 } })
    s = applyAction(s, { type: 'ptTurn', actor: 'p1', id, power: -3, toughness: -3 })
    expect(s.cards[id]).not.toHaveProperty('ptTurn')
    expect(lastText(s)).toBe('Kenrith, the Returned King : 6/5 (+1/+0)')
  })

  it('effacée à la fin du tour, chez tous les joueurs ; la modification permanente reste', () => {
    let s = apply(game(),
      { type: 'pt', actor: 'p1', id: kenrith('p1'), power: 1, toughness: 1 },
      { type: 'ptTurn', actor: 'p1', id: kenrith('p1'), power: 2, toughness: 2 },
      { type: 'ptTurn', actor: 'p1', id: delver('p2'), power: 2, toughness: 2 })
    s = applyAction(s, { type: 'endTurn', actor: s.activePlayer })
    expect(s.cards[kenrith('p1')].ptMod).toEqual({ power: 1, toughness: 1 })
    expect(s.cards[kenrith('p1')]).not.toHaveProperty('ptTurn')
    expect(s.cards[delver('p2')]).not.toHaveProperty('ptTurn')
  })

  it('seulement sur le champ de bataille, perdue en le quittant ; face cachée sans son nom', () => {
    const s = game()
    expect(canApply(s, { type: 'ptTurn', actor: 'p1', id: card('p1', 2), power: 1, toughness: 1 })).not.toBeNull()
    const modified = applyAction(s, { type: 'ptTurn', actor: 'p1', id: delver('p1'), power: 1, toughness: 1 })
    const moved = applyAction(modified, { type: 'move', actor: 'p1', id: delver('p1'), to: { player: 'p1', zone: 'hand' } })
    expect(moved.cards[delver('p1')]).not.toHaveProperty('ptTurn')
    const hidden = apply(s, { type: 'faceDown', actor: 'p1', id: delver('p1') }, { type: 'ptTurn', actor: 'p2', id: delver('p1'), power: 2, toughness: 0 })
    expect(lastText(hidden)).toBe('une carte face cachée : 4/2 (+2/+0 ce tour)')
  })
})

describe('effet sur plusieurs créatures', () => {
  it('+X/+X et Célérité jusqu’à la fin du tour : une ligne de journal, effacé à la fin du tour', () => {
    const ids = [kenrith('p1'), delver('p1')]
    let s = applyAction(game(), { type: 'effect', actor: 'p1', ids, power: 10, toughness: 10, gained: ['Haste'], untilEndOfTurn: true })
    expect(s.cards[kenrith('p1')]).toMatchObject({ ptTurn: { power: 10, toughness: 10 }, gained: [{ keyword: 'Haste', untilEndOfTurn: true }] })
    expect(s.cards[delver('p1')]).toMatchObject({ ptTurn: { power: 10, toughness: 10 }, gained: [{ keyword: 'Haste', untilEndOfTurn: true }] })
    expect(s.log.at(-1)).toMatchObject({
      actor: 'p1', text: 'donne +10/+10 et Célérité à Kenrith, the Returned King et Delver of Secrets // Insectile Aberration (jusqu’à la fin du tour)',
    })
    s = applyAction(s, { type: 'endTurn', actor: s.activePlayer })
    expect(s.cards[kenrith('p1')]).not.toHaveProperty('ptTurn')
    expect(s.cards[kenrith('p1')]).not.toHaveProperty('gained')
  })

  it('tout le temps : modification permanente ajoutée, capacités déjà données gardées', () => {
    let s = apply(game(),
      { type: 'pt', actor: 'p1', id: kenrith('p1'), power: 1, toughness: 0 },
      { type: 'abilities', actor: 'p1', id: kenrith('p1'), gained: ['Trample'], lost: [] })
    s = applyAction(s, { type: 'effect', actor: 'p2', ids: [kenrith('p1'), delver('p2')], power: 1, toughness: 1, gained: ['Trample', 'Vigilance'] })
    expect(s.cards[kenrith('p1')].ptMod).toEqual({ power: 2, toughness: 1 })
    expect(s.cards[kenrith('p1')].gained).toEqual([{ keyword: 'Trample' }, { keyword: 'Vigilance' }])
    expect(s.cards[delver('p2')].gained).toEqual([{ keyword: 'Trample' }, { keyword: 'Vigilance' }])
    expect(lastText(s)).toBe('donne +1/+1, Piétinement et Vigilance à Kenrith, the Returned King et Delver of Secrets // Insectile Aberration')
  })

  it('une capacité « ce tour » devient permanente si l’effet est permanent, jamais l’inverse', () => {
    let s = applyAction(game(), { type: 'abilities', actor: 'p1', id: kenrith('p1'), gained: ['Haste'], lost: [], untilEndOfTurn: true })
    s = applyAction(s, { type: 'effect', actor: 'p1', ids: [kenrith('p1')], power: 0, toughness: 0, gained: ['Haste'] })
    expect(s.cards[kenrith('p1')].gained).toEqual([{ keyword: 'Haste' }])
    s = applyAction(s, { type: 'effect', actor: 'p1', ids: [kenrith('p1')], power: 0, toughness: 0, gained: ['Haste'], untilEndOfTurn: true })
    expect(s.cards[kenrith('p1')].gained).toEqual([{ keyword: 'Haste' }])
  })

  it('beaucoup de cartes : noms abrégés ; face cachée sans son nom', () => {
    let s = applyAction(game(), { type: 'faceDown', actor: 'p1', id: delver('p1') })
    s = applyAction(s, { type: 'effect', actor: 'p1', ids: [delver('p1'), kenrith('p1')], power: 2, toughness: 0, gained: [], untilEndOfTurn: true })
    expect(lastText(s)).toBe('donne +2/+0 à une carte face cachée et Kenrith, the Returned King (jusqu’à la fin du tour)')
    const many = place(game(), [3, 5, 6, 7].map((n) => ({ id: card('p1', 3, n), player: 'p1', zone: 'battlefield' as const })))
    const ids = [kenrith('p1'), delver('p1'), ...[3, 5, 6, 7].map((n) => card('p1', 3, n))]
    const after = applyAction(many, { type: 'effect', actor: 'p1', ids, power: 1, toughness: 1, gained: [], untilEndOfTurn: true })
    expect(lastText(after)).toBe('donne +1/+1 à Kenrith, the Returned King, Delver of Secrets // Insectile Aberration, Forest et 3 autres cartes (jusqu’à la fin du tour)')
  })

  it('refusé hors du champ de bataille, sans carte, en double ou sans rien à donner', () => {
    const s = game()
    expect(canApply(s, { type: 'effect', actor: 'p1', ids: [kenrith('p1'), card('p1', 2)], power: 1, toughness: 1, gained: [] })).not.toBeNull()
    expect(canApply(s, { type: 'effect', actor: 'p1', ids: [], power: 1, toughness: 1, gained: [] })).not.toBeNull()
    expect(canApply(s, { type: 'effect', actor: 'p1', ids: [kenrith('p1'), kenrith('p1')], power: 1, toughness: 1, gained: [] })).not.toBeNull()
    expect(canApply(s, { type: 'effect', actor: 'p1', ids: [kenrith('p1')], power: 0, toughness: 0, gained: [] })).not.toBeNull()
    expect(canApply(s, { type: 'effect', actor: 'p3', ids: [kenrith('p1'), delver('p2')], power: 1, toughness: 0, gained: [] })).toBeNull()
  })
})
