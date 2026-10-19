import { describe, it, expect } from 'vitest'
import { run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { isVisibleTo } from './rules'
import { shuffle } from './random'
import { viewFor } from './view'
import type { GameAction, GameState, Position } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const game = () => run(setupFor('commander', 3), start(1))
const search = (actor: string, target: string): GameAction => ({ type: 'search', actor, target })
const end = (actor: string, target: string, shuffle = true, seed = 7): GameAction => ({ type: 'endLook', actor, target, shuffle, seed, keep: true })
const put = (actor: string, id: string, player: string, position: Position): GameAction =>
  ({ type: 'move', actor, id, to: { player, zone: 'library' }, position })

describe('recherche puis mélange : les cartes posées dessus ou dessous restent en place', () => {
  it('la carte mise au-dessus pendant la recherche reste au-dessus après le mélange', () => {
    let s = applyAction(game(), search('p1', 'p1'))
    const tutored = s.players.p1.zones.library[20]
    s = apply(s, put('p1', tutored, 'p1', 'top'), end('p1', 'p1'))
    expect(s.players.p1.zones.library[0]).toBe(tutored)
    expect(s.log.at(-1)?.text).toBe('mélange sa bibliothèque et met une carte au-dessus')
  })

  it('le reste est mélangé', () => {
    const s0 = applyAction(game(), search('p1', 'p1'))
    const tutored = s0.players.p1.zones.library[20]
    const s = apply(s0, put('p1', tutored, 'p1', 'top'), end('p1', 'p1'))
    const rest = s0.players.p1.zones.library.filter((id) => id !== tutored)
    expect(s.players.p1.zones.library.slice(1)).not.toEqual(rest)
    expect([...s.players.p1.zones.library.slice(1)].sort()).toEqual([...rest].sort())
  })

  it('plusieurs cartes : la dernière posée est au-dessus ; la carte du dessous reste dessous', () => {
    let s = applyAction(game(), search('p1', 'p1'))
    const [a, b, c] = [s.players.p1.zones.library[10], s.players.p1.zones.library[11], s.players.p1.zones.library[12]]
    s = apply(s, put('p1', a, 'p1', 'top'), put('p1', b, 'p1', 'top'), put('p1', c, 'p1', 'bottom'), end('p1', 'p1'))
    expect(s.players.p1.zones.library.slice(0, 2)).toEqual([b, a])
    expect(s.players.p1.zones.library.at(-1)).toBe(c)
    expect(s.log.at(-1)?.text).toBe('mélange sa bibliothèque, met 2 cartes au-dessus et une carte dessous')
  })

  it('une carte venue d’une autre zone pendant la recherche est aussi gardée', () => {
    let s = applyAction(game(), search('p1', 'p1'))
    const fromHand = s.players.p1.zones.hand[0]
    s = apply(s, put('p1', fromHand, 'p1', 'top'), end('p1', 'p1'))
    expect(s.players.p1.zones.library[0]).toBe(fromHand)
  })

  it('une carte reprise ensuite de la bibliothèque n’est plus gardée', () => {
    let s = applyAction(game(), search('p1', 'p1'))
    const [a, b] = [s.players.p1.zones.library[10], s.players.p1.zones.library[11]]
    s = apply(s, put('p1', a, 'p1', 'top'), put('p1', b, 'p1', 'top'))
    s = applyAction(s, { type: 'move', actor: 'p1', id: b, to: { player: 'p1', zone: 'hand' } })
    s = applyAction(s, end('p1', 'p1'))
    expect(s.players.p1.zones.library[0]).toBe(a)
    expect(s.log.at(-1)?.text).toBe('mélange sa bibliothèque et met une carte au-dessus')
  })

  it('une carte posée avant la recherche est mélangée', () => {
    const s0 = game()
    const fromHand = s0.players.p1.zones.hand[0]
    let s = apply(s0, put('p1', fromHand, 'p1', 'top'), search('p1', 'p1'), end('p1', 'p1'))
    expect(s.log.at(-1)?.text).toBe('mélange sa bibliothèque')
    // Plusieurs graines : la carte ne reste pas toujours au-dessus.
    const tops = [1, 2, 3, 4, 5].map((seed) => apply(s0, put('p1', fromHand, 'p1', 'top'), search('p1', 'p1'), end('p1', 'p1', true, seed)).players.p1.zones.library[0])
    expect(tops.some((id) => id !== fromHand)).toBe(true)
    s = apply(s, search('p1', 'p1'), end('p1', 'p1'))
    expect(s.log.at(-1)?.text).toBe('mélange sa bibliothèque')
  })

  it('sans mélange, rien ne change et la recherche suivante repart de zéro', () => {
    let s = applyAction(game(), search('p1', 'p1'))
    const tutored = s.players.p1.zones.library[20]
    s = apply(s, put('p1', tutored, 'p1', 'top'), end('p1', 'p1', false))
    expect(s.players.p1.zones.library[0]).toBe(tutored)
    expect(s.log.at(-1)?.text).toBe('arrête de regarder sa bibliothèque')
    const tops = [1, 2, 3, 4, 5].map((seed) => apply(s, search('p1', 'p1'), end('p1', 'p1', true, seed)).players.p1.zones.library[0])
    expect(tops.some((id) => id !== tutored)).toBe(true)
  })

  it('bibliothèque d’un adversaire : la carte gardée reste cachée aux autres, connue de celui qui l’a posée', () => {
    let s = applyAction(game(), search('p1', 'p2'))
    const tutored = s.players.p2.zones.library[20]
    s = apply(s, put('p1', tutored, 'p2', 'top'), end('p1', 'p2'))
    expect(s.players.p2.zones.library[0]).toBe(tutored)
    expect(isVisibleTo(s, tutored, 'p1')).toBe(true)
    expect(isVisibleTo(s, tutored, 'p2')).toBe(false)
    expect(isVisibleTo(s, tutored, 'p3')).toBe(false)
    expect(s.players.p2.zones.library.slice(1).some((id) => isVisibleTo(s, id, 'p1'))).toBe(false)
    expect(s.log.at(-1)?.text).toBe('mélange la bibliothèque de Bob et met une carte au-dessus')
    for (const p of ['p2', 'p3']) expect(JSON.stringify(viewFor(s, p))).not.toContain(tutored)
  })

  it('seules les cartes posées par celui qui ferme sa recherche sont gardées', () => {
    let s = apply(game(), search('p1', 'p2'), search('p3', 'p2'))
    const tutored = s.players.p2.zones.library[20]
    s = apply(s, put('p3', tutored, 'p2', 'top'))
    const tops = [1, 2, 3, 4, 5].map((seed) => applyAction(s, end('p1', 'p2', true, seed)).players.p2.zones.library[0])
    expect(tops.some((id) => id !== tutored)).toBe(true)
    expect(applyAction(s, end('p3', 'p2')).players.p2.zones.library[0]).toBe(tutored)
  })
})

describe('parties rejouées', () => {
  it('une fin de recherche jouée avant cette règle (sans `keep`) mélange toute la bibliothèque, comme avant', () => {
    let s = applyAction(game(), search('p1', 'p1'))
    const tutored = s.players.p1.zones.library[20]
    s = applyAction(s, put('p1', tutored, 'p1', 'top'))
    const old = (seed: number) => applyAction(s, { type: 'endLook', actor: 'p1', target: 'p1', shuffle: true, seed })
    for (const seed of [1, 2, 3]) {
      const after = old(seed)
      expect(after.players.p1.zones.library).toEqual(shuffle(s.players.p1.zones.library, seed))
      expect(after.log.at(-1)?.text).toBe('mélange sa bibliothèque')
      expect(after.lookKept?.p1).toBeUndefined()
    }
  })
})
