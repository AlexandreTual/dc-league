import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction, cardName } from './apply'
import { isVisibleTo, zoneOf } from './rules'
import type { GameAction, GameState } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const sol = (p: string) => card(p, 2)
const game = () => run(setupFor('commander', 3), start(1))

describe('reveal', () => {
  it('révèle une carte de main à un joueur, jusqu’à ce qu’elle change de zone', () => {
    let s = place(game(), [{ id: sol('p1'), player: 'p1', zone: 'hand' }])
    s = applyAction(s, { type: 'reveal', actor: 'p1', ids: [sol('p1')], to: ['p3'] })
    expect(isVisibleTo(s, sol('p1'), 'p3')).toBe(true)
    expect(isVisibleTo(s, sol('p1'), 'p2')).toBe(false)
    expect(s.log.at(-2)).toMatchObject({ text: 'révèle 1 carte à Chloé', visibleTo: 'all' })
    expect(s.log.at(-1)).toMatchObject({ text: 'Révélé à Chloé : Anneau solaire', visibleTo: ['p1', 'p3'] })

    s = apply(s, { type: 'move', actor: 'p1', id: sol('p1'), to: { player: 'p1', zone: 'library' } }, { type: 'shuffle', actor: 'p1', seed: 4 })
    expect(isVisibleTo(s, sol('p1'), 'p3')).toBe(false)
  })

  it('révèle toute sa main à tous', () => {
    const s = applyAction(game(), { type: 'reveal', actor: 'p2', ids: 'hand', to: 'all' })
    for (const id of s.players.p2.zones.hand) {
      expect(isVisibleTo(s, id, 'p1')).toBe(true)
      expect(isVisibleTo(s, id, 'p3')).toBe(true)
    }
    const names = s.players.p2.zones.hand.map((id) => cardName(s, id)).join(', ')
    expect(s.log.at(-1)).toMatchObject({ text: `révèle : ${names}`, visibleTo: 'all' })
  })

  it('refuse de révéler une carte qui n’est pas dans sa main', () => {
    const s = game()
    expect(applyAction(s, { type: 'reveal', actor: 'p1', ids: [s.players.p2.zones.hand[0]], to: 'all' })).toBe(s)
  })
})

describe('look, search, endLook', () => {
  it('regarde les cartes du dessus d’un autre, avec journal public et privé', () => {
    const s0 = game()
    const top3 = s0.players.p2.zones.library.slice(0, 3)
    const s = applyAction(s0, { type: 'look', actor: 'p1', target: 'p2', count: 3 })
    for (const id of top3) {
      expect(isVisibleTo(s, id, 'p1')).toBe(true)
      expect(isVisibleTo(s, id, 'p2')).toBe(false)
      expect(isVisibleTo(s, id, 'p3')).toBe(false)
    }
    expect(isVisibleTo(s, s0.players.p2.zones.library[3], 'p1')).toBe(false)
    expect(s.lookingAt.p1).toEqual(['p2'])
    const publicLine = s.log.at(-2)!
    expect(publicLine).toMatchObject({ text: 'regarde les 3 cartes du dessus de la bibliothèque de Bob', visibleTo: 'all' })
    for (const id of top3) expect(publicLine.text).not.toContain(cardName(s, id))
    expect(s.log.at(-1)).toMatchObject({ text: `Tu as vu : ${top3.map((id) => cardName(s, id)).join(', ')}`, visibleTo: ['p1'] })

    const ended = applyAction(s, { type: 'endLook', actor: 'p1', target: 'p2', shuffle: false })
    for (const id of top3) expect(isVisibleTo(ended, id, 'p1')).toBe(false)
    expect(ended.lookingAt.p1).toEqual([])
    expect(ended.players.p2.zones.library).toEqual(s0.players.p2.zones.library)
  })

  it('regarde sa propre bibliothèque', () => {
    const s = applyAction(game(), { type: 'look', actor: 'p1', target: 'p1', count: 1 })
    expect(s.log.at(-2)?.text).toBe('regarde la carte du dessus de sa bibliothèque')
  })

  it('fouille, prend une carte, puis mélange', () => {
    const s0 = game()
    let s = applyAction(s0, { type: 'search', actor: 'p1', target: 'p2' })
    expect(s.log.at(-1)).toMatchObject({ text: 'fouille la bibliothèque de Bob', visibleTo: 'all' })
    expect(s.players.p2.zones.library.every((id) => isVisibleTo(s, id, 'p1'))).toBe(true)
    const taken = s.players.p2.zones.library[5]
    s = applyAction(s, { type: 'move', actor: 'p1', id: taken, to: { player: 'p1', zone: 'battlefield' } })
    expect(zoneOf(s, taken)).toEqual({ player: 'p1', zone: 'battlefield' })
    s = applyAction(s, { type: 'endLook', actor: 'p1', target: 'p2', shuffle: true, seed: 7 })
    expect(s.players.p2.zones.library).toHaveLength(s0.players.p2.zones.library.length - 1)
    expect(s.players.p2.zones.library).not.toEqual(s0.players.p2.zones.library.filter((id) => id !== taken))
    expect(s.players.p2.zones.library.some((id) => isVisibleTo(s, id, 'p1'))).toBe(false)
    expect(s.log.at(-1)?.text).toBe('mélange la bibliothèque de Bob')
  })

  it('refuse de prendre dans une bibliothèque qu’on ne regarde plus', () => {
    let s = applyAction(game(), { type: 'look', actor: 'p1', target: 'p2', count: 1 })
    const top = s.players.p2.zones.library[0]
    s = applyAction(s, { type: 'endLook', actor: 'p1', target: 'p2', shuffle: false })
    expect(applyAction(s, { type: 'move', actor: 'p1', id: top, to: { player: 'p1', zone: 'battlefield' } })).toBe(s)
  })
})

describe('dessus de bibliothèque', () => {
  it('toggleTopRevealed : la carte du dessus est visible par tous, puis la suivante', () => {
    let s = applyAction(game(), { type: 'toggleTopRevealed', actor: 'p1' })
    const top = s.players.p1.zones.library[0]
    expect(isVisibleTo(s, top, 'p2')).toBe(true)
    s = applyAction(s, { type: 'draw', actor: 'p1', count: 1 })
    expect(isVisibleTo(s, top, 'p2')).toBe(false)
    expect(isVisibleTo(s, s.players.p1.zones.library[0], 'p2')).toBe(true)
    s = applyAction(s, { type: 'toggleTopRevealed', actor: 'p1' })
    expect(isVisibleTo(s, s.players.p1.zones.library[0], 'p2')).toBe(false)
  })

  it('revealTop : journal public avec le nom', () => {
    const s0 = game()
    const s = applyAction(s0, { type: 'revealTop', actor: 'p2' })
    expect(s.log.at(-1)).toMatchObject({ actor: 'p2', text: `révèle ${cardName(s, s0.players.p2.zones.library[0])}`, visibleTo: 'all' })
  })
})
