import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction, cardName } from './apply'
import { canApply } from './rules'
import type { GameAction, GameState } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const delver = (p: string) => card(p, 4)
const game = () => run(setupFor('commander', 3), start(1))

describe('oracle reorderTop', () => {
  it('même refus pour une carte cachée, qu’elle soit en main, en bibliothèque ou inexistante', () => {
    const s = applyAction(game(), { type: 'look', actor: 'p1', target: 'p2', count: 1 })
    const [seen, notSeen] = s.players.p2.zones.library
    const reorder = (id: string): GameAction => ({ type: 'reorderTop', actor: 'p1', target: 'p2', ids: [seen, id] })
    const inHand = s.players.p2.zones.hand[0]
    const hidden = 'Cette carte est cachée'
    expect(canApply(s, reorder(notSeen))).toBe(hidden)
    expect(canApply(s, reorder(inHand))).toBe(hidden)
    expect(canApply(s, reorder('p2:c3-99'))).toBe(hidden)
    expect(canApply(s, reorder('n-importe-quoi'))).toBe(hidden)
  })
})

describe('journal des cartes face cachée', () => {
  const faceDownDelver = () =>
    apply(place(game(), [{ id: delver('p1'), player: 'p1', zone: 'battlefield' }]), { type: 'faceDown', actor: 'p1', id: delver('p1') })

  it('giveControl ne nomme pas une carte face cachée', () => {
    const s = applyAction(faceDownDelver(), { type: 'giveControl', actor: 'p1', id: delver('p1'), to: 'p2' })
    expect(s.players.p2.zones.battlefield).toContain(delver('p1'))
    expect(s.log.at(-1)?.text).toBe('donne le contrôle d’une carte face cachée à Bob')
    expect(s.log.at(-1)?.text).not.toContain(cardName(s, delver('p1')))
  })

  it('flip ne nomme pas une carte face cachée', () => {
    const s = applyAction(faceDownDelver(), { type: 'flip', actor: 'p1', id: delver('p1') })
    expect(s.cards[delver('p1')].flipped).toBe(true)
    expect(s.log.at(-1)?.text).toBe('Transforme une carte face cachée')
  })

  it('carte face visible : le nom reste dans le journal', () => {
    const s0 = place(game(), [{ id: delver('p1'), player: 'p1', zone: 'battlefield' }])
    const name = cardName(s0, delver('p1'))
    expect(applyAction(s0, { type: 'giveControl', actor: 'p1', id: delver('p1'), to: 'p2' }).log.at(-1)?.text).toBe(`donne le contrôle de ${name} à Bob`)
    expect(applyAction(s0, { type: 'flip', actor: 'p1', id: delver('p1') }).log.at(-1)?.text).toBe(`Transforme ${name}`)
  })
})

describe('graines', () => {
  const setup = setupFor('commander', 2)

  it('rejoue à l’identique une partie à graine numérique 32 bits (ancien générateur)', () => {
    const s = run(setup, start(4242), { type: 'mulligan', actor: 'p1', seed: 77 })
    expect(s.turnOrder).toEqual(['p1', 'p2'])
    expect(s.players.p1.zones.hand).toEqual(['p1:c3-22', 'p1:c2-1', 'p1:c3-6', 'p1:c4-1', 'p1:c3-25', 'p1:c3-14', 'p1:c3-10'])
    expect(s.players.p2.zones.hand).toEqual(['p2:c3-15', 'p2:c3-12', 'p2:c3-1', 'p2:c3-16', 'p2:c3-30', 'p2:c3-22', 'p2:c3-25'])
  })

  const a = '0123456789abcdef0123456789abcdef'
  const b = 'fedcba9876543210fedcba9876543210'
  const c = '00000000111111112222222233333333'
  const startWith = (seeds: Record<string, string>): GameAction => ({ type: 'start', actor: 'server', seed: c, seeds })

  it('nouvelle partie : chaque joueur a sa propre graine, indépendante des autres', () => {
    const s1 = run(setup, startWith({ p1: a, p2: b }))
    const s2 = run(setup, startWith({ p1: a, p2: c }))
    expect(s2.players.p1.zones.library).toEqual(s1.players.p1.zones.library)
    expect(s2.players.p1.zones.hand).toEqual(s1.players.p1.zones.hand)
    expect(s2.players.p2.zones.library).not.toEqual(s1.players.p2.zones.library)
  })

  it('nouvelle partie : déterministe pour les mêmes graines', () => {
    expect(run(setup, startWith({ p1: a, p2: b }))).toEqual(run(setup, startWith({ p1: a, p2: b })))
  })
})
