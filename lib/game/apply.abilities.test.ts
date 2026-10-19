import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { viewFor } from './view'
import type { GameAction, GameState } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const kenrith = (p: string) => card(p, 1)
const delver = (p: string) => card(p, 4)

function game(): GameState {
  return place(run(setupFor('commander', 3), start(1)), [
    { id: kenrith('p1'), player: 'p1', zone: 'battlefield' },
    { id: delver('p1'), player: 'p1', zone: 'battlefield' },
  ])
}

describe('capacités données', () => {
  it('tout joueur en donne à un permanent : état voulu, journal, vue des autres joueurs', () => {
    const id = kenrith('p1')
    const s = applyAction(game(), { type: 'abilities', actor: 'p2', id, gained: ['Trample', 'Haste'], lost: [], untilEndOfTurn: true })
    expect(s.cards[id].gained).toEqual([{ keyword: 'Trample', untilEndOfTurn: true }, { keyword: 'Haste', untilEndOfTurn: true }])
    expect(s.cards[id]).not.toHaveProperty('lost')
    expect(s.log.at(-1)).toMatchObject({ actor: 'p2', text: 'donne Piétinement et Célérité à Kenrith, the Returned King (jusqu’à la fin du tour)' })
    expect(viewFor(s, 'p3').players.p1.zones.battlefield.find((c) => !c.hidden && c.id === id))
      .toMatchObject({ gained: [{ keyword: 'Trample', untilEndOfTurn: true }, { keyword: 'Haste', untilEndOfTurn: true }] })
  })

  it('capacité imprimée perdue, puis rendue ; tout retiré : champs absents', () => {
    const id = delver('p1')
    let s = applyAction(game(), { type: 'abilities', actor: 'p1', id, gained: [], lost: ['Flying'] })
    expect(s.cards[id].lost).toEqual(['Flying'])
    expect(s.log.at(-1)?.text).toBe('retire Vol à Delver of Secrets // Insectile Aberration')
    s = applyAction(s, { type: 'abilities', actor: 'p1', id, gained: [], lost: [] })
    expect(s.cards[id]).not.toHaveProperty('lost')
    expect(s.cards[id]).not.toHaveProperty('gained')
    expect(s.log.at(-1)?.text).toBe('rend Vol à Delver of Secrets // Insectile Aberration')
  })

  it('Protection et Parade avec leur précision ; précision changée', () => {
    const id = kenrith('p1')
    let s = applyAction(game(), { type: 'abilities', actor: 'p1', id, gained: [{ keyword: 'Protection', param: 'R,G' }, { keyword: 'Ward', param: '{2}' }], lost: [] })
    expect(s.cards[id].gained).toEqual([{ keyword: 'Protection', param: 'R,G' }, { keyword: 'Ward', param: '{2}' }])
    expect(s.log.at(-1)?.text).toBe('donne Protection contre le rouge et le vert et Parade {2} à Kenrith, the Returned King')
    s = applyAction(s, { type: 'abilities', actor: 'p2', id, gained: [{ keyword: 'Protection', param: 'all' }, { keyword: 'Ward', param: '{2}' }], lost: [] })
    expect(s.log.at(-1)).toMatchObject({ actor: 'p2', text: 'change Protection de Kenrith, the Returned King : contre tout' })
  })

  it('Annihilateur avec son nombre, traversée des forêts ; nombre changé', () => {
    const id = kenrith('p1')
    let s = applyAction(game(), { type: 'abilities', actor: 'p1', id, gained: ['Forestwalk', { keyword: 'Annihilator', param: '2' }], lost: [] })
    expect(s.cards[id].gained).toEqual([{ keyword: 'Forestwalk' }, { keyword: 'Annihilator', param: '2' }])
    expect(s.log.at(-1)?.text).toBe('donne Traversée des forêts et Annihilateur 2 à Kenrith, the Returned King')
    s = applyAction(s, { type: 'abilities', actor: 'p1', id, gained: ['Forestwalk', { keyword: 'Annihilator', param: '4' }], lost: [] })
    expect(s.log.at(-1)?.text).toBe('change Annihilateur de Kenrith, the Returned King : 4')
  })

  it('rien de changé : état et journal inchangés', () => {
    const s = applyAction(game(), { type: 'abilities', actor: 'p1', id: kenrith('p1'), gained: ['Haste'], lost: [] })
    expect(applyAction(s, { type: 'abilities', actor: 'p1', id: kenrith('p1'), gained: ['Haste'], lost: [] })).toBe(s)
  })

  it('carte face cachée : capacités gardées, son nom n’apparaît pas au journal', () => {
    const id = delver('p1')
    const s = apply(game(), { type: 'faceDown', actor: 'p1', id }, { type: 'abilities', actor: 'p1', id, gained: ['Menace'], lost: [] })
    expect(s.log.at(-1)?.text).toBe('donne Menace à une carte face cachée')
    // Son propriétaire la connaît ; pour les autres, une carte face cachée ne livre rien (comme sa force modifiée).
    expect(viewFor(s, 'p1').players.p1.zones.battlefield.find((c) => !c.hidden && c.id === id)).toMatchObject({ faceDown: true, gained: [{ keyword: 'Menace' }] })
  })

  it('seulement sur le champ de bataille ; perdues en le quittant, gardées en changeant de place ou de contrôleur', () => {
    const s = game()
    expect(applyAction(s, { type: 'abilities', actor: 'p1', id: card('p1', 2), gained: ['Haste'], lost: [] })).toBe(s)
    const given = applyAction(s, { type: 'abilities', actor: 'p1', id: delver('p1'), gained: ['Haste'], lost: ['Flying'] })
    const gone = applyAction(given, { type: 'move', actor: 'p1', id: delver('p1'), to: { player: 'p1', zone: 'hand' } })
    expect(gone.cards[delver('p1')]).not.toHaveProperty('gained')
    expect(gone.cards[delver('p1')]).not.toHaveProperty('lost')
    const shifted = applyAction(given, { type: 'move', actor: 'p1', id: delver('p1'), to: { player: 'p1', zone: 'battlefield' }, x: 10, y: 10 })
    expect(shifted.cards[delver('p1')]).toMatchObject({ gained: [{ keyword: 'Haste' }], lost: ['Flying'] })
    const stolen = applyAction(given, { type: 'giveControl', actor: 'p1', id: delver('p1'), to: 'p2' })
    expect(stolen.cards[delver('p1')]).toMatchObject({ gained: [{ keyword: 'Haste' }] })
  })

  it('fin du tour : seules les capacités « jusqu’à la fin du tour » disparaissent, chez tous les joueurs', () => {
    let s = apply(game(),
      { type: 'abilities', actor: 'p1', id: kenrith('p1'), gained: ['Haste'], lost: [], untilEndOfTurn: true },
      { type: 'abilities', actor: 'p1', id: kenrith('p1'), gained: ['Haste', 'Trample'], lost: [] },
      { type: 'abilities', actor: 'p2', id: delver('p1'), gained: ['Deathtouch'], lost: [], untilEndOfTurn: true })
    s = applyAction(s, { type: 'endTurn', actor: s.activePlayer })
    expect(s.cards[kenrith('p1')].gained).toEqual([{ keyword: 'Trample' }])
    expect(s.cards[delver('p1')]).not.toHaveProperty('gained')
  })
})
