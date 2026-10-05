import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction, cardData, taxOf } from './apply'
import type { GameAction, GameState, TokenData } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const lastText = (s: GameState) => s.log.at(-1)?.text
const kenrith = (p: string) => card(p, 1)
const delver = (p: string) => card(p, 4)
const soldier: TokenData = { name: 'Soldat', typeLine: 'Token Creature — Soldat', power: '1', toughness: '1', colors: [], image: null }

function game(format: 'commander' | 'duel' = 'commander', n = 3): GameState {
  const s = run(setupFor(format, n), start(1))
  return place(s, [
    { id: card('p1', 2), player: 'p1', zone: 'battlefield' },
    { id: card('p2', 2), player: 'p2', zone: 'battlefield' },
    { id: delver('p1'), player: 'p1', zone: 'battlefield' },
  ])
}

describe('cartes', () => {
  it('engage la carte d’un autre ; untapAll ne dégage que ses permanents', () => {
    let s = applyAction(game(), { type: 'tap', actor: 'p1', id: card('p2', 2) })
    expect(s.cards[card('p2', 2)].tapped).toBe(true)
    s = apply(s, { type: 'tap', actor: 'p1', id: card('p1', 2) }, { type: 'untapAll', actor: 'p1' })
    expect(s.cards[card('p1', 2)].tapped).toBe(false)
    expect(s.cards[card('p2', 2)].tapped).toBe(true)
  })

  it('flip montre la face B ; faceDown cache la carte', () => {
    const s = applyAction(game(), { type: 'flip', actor: 'p1', id: delver('p1') })
    expect(s.cards[delver('p1')].flipped).toBe(true)
    expect(cardData(s, delver('p1'), 'en')).toMatchObject({ name: 'Insectile Aberration', image: 'back.jpg' })
    expect(applyAction(game(), { type: 'flip', actor: 'p2', id: delver('p1') })).toEqual(game())
    const hidden = applyAction(game(), { type: 'faceDown', actor: 'p1', id: delver('p1') })
    expect(hidden.cards[delver('p1')]).toMatchObject({ faceDown: true, knownBy: ['p1'] })
    expect(applyAction(hidden, { type: 'faceDown', actor: 'p1', id: delver('p1') }).cards[delver('p1')]).toMatchObject({ faceDown: false, knownBy: [] })
  })

  it('compteurs bornés à 0', () => {
    const s = apply(game(), { type: 'counter', actor: 'p1', id: card('p1', 2), kind: 'plus', delta: 2 }, { type: 'counter', actor: 'p1', id: card('p1', 2), kind: 'plus', delta: -5 })
    expect(s.cards[card('p1', 2)].counters.plus).toBe(0)
  })

  it('jetons : sur le champ de bataille de l’auteur, identifiants partagés', () => {
    const s = apply(
      game(),
      { type: 'createToken', actor: 'p1', token: soldier, x: 10, y: 10 },
      { type: 'createToken', actor: 'p2', token: soldier, x: 10, y: 10 },
    )
    expect(s.players.p1.zones.battlefield).toContain('t1')
    expect(s.players.p2.zones.battlefield).toContain('t2')
    expect(s.cards.t2.owner).toBe('p2')
  })

  it('taxe de commandant modifiable par son propriétaire, bornée à 0', () => {
    let s = applyAction(game(), { type: 'commanderTax', actor: 'p1', id: kenrith('p1'), delta: 2 })
    expect(taxOf(s, kenrith('p1'))).toBe(4)
    s = applyAction(s, { type: 'commanderTax', actor: 'p1', id: kenrith('p1'), delta: -5 })
    expect(taxOf(s, kenrith('p1'))).toBe(0)
    expect(applyAction(s, { type: 'commanderTax', actor: 'p2', id: kenrith('p1'), delta: 1 })).toBe(s)
  })
})

describe('compteurs de joueur', () => {
  it('vie d’un autre joueur, avec journal', () => {
    const s = applyAction(game(), { type: 'life', actor: 'p2', target: 'p1', delta: -3 })
    expect(s.players.p1.life).toBe(37)
    expect(s.log.at(-1)).toMatchObject({ actor: 'p2', text: 'Alex 40 → 37' })
    expect(applyAction(s, { type: 'life', actor: 'p2', target: 'p1', delta: -50 }).players.p1.life).toBe(-13)
  })

  it('blessures de commandant par commandant, la vie suit', () => {
    let s = applyAction(game(), { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: kenrith('p2'), delta: 5 })
    expect(s.players.p1.commanderDamage[kenrith('p2')]).toBe(5)
    expect(s.players.p1.life).toBe(35)
    expect(lastText(s)).toBe('Alex : 5 blessures de Kenrith, the Returned King (vie 35)')
    s = applyAction(s, { type: 'commanderDamage', actor: 'p3', target: 'p1', commander: kenrith('p3'), delta: 3 })
    expect(s.players.p1.commanderDamage).toEqual({ [kenrith('p2')]: 5, [kenrith('p3')]: 3 })
    expect(s.players.p1.life).toBe(32)
    s = applyAction(s, { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: kenrith('p2'), delta: -8 })
    expect(s.players.p1.commanderDamage[kenrith('p2')]).toBe(0)
    expect(s.players.p1.life).toBe(37)
  })

  it('pas de blessures de commandant en duel', () => {
    const s = game('duel', 2)
    expect(applyAction(s, { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: kenrith('p2'), delta: 5 })).toBe(s)
  })

  it('poison borné à 0, compteurs libres', () => {
    let s = apply(game(), { type: 'poison', actor: 'p1', target: 'p2', delta: 3 }, { type: 'poison', actor: 'p1', target: 'p2', delta: -5 })
    expect(s.players.p2.poison).toBe(0)
    s = apply(s, { type: 'playerCounter', actor: 'p1', target: 'p1', name: 'Énergie', delta: 4 }, { type: 'playerCounter', actor: 'p1', target: 'p1', name: 'Énergie', delta: -1 })
    expect(s.players.p1.counters).toEqual({ Énergie: 3 })
    expect(lastText(s)).toBe('Alex : Énergie 3')
  })

  it('monarque et initiative : un seul détenteur', () => {
    let s = apply(game(), { type: 'setMonarch', actor: 'p1', to: 'p2' }, { type: 'setMonarch', actor: 'p3', to: 'p3' })
    expect(s.monarch).toBe('p3')
    expect(lastText(s)).toBe('Chloé devient le monarque')
    s = applyAction(s, { type: 'setMonarch', actor: 'p3', to: null })
    expect(s.monarch).toBeNull()
    s = apply(s, { type: 'setInitiative', actor: 'p1', to: 'p1' }, { type: 'setInitiative', actor: 'p2', to: 'p2' })
    expect(s.initiative).toBe('p2')
    expect(lastText(s)).toBe('Bob prend l’initiative')
    expect(applyAction(s, { type: 'setInitiative', actor: 'p2', to: null }).initiative).toBeNull()
  })
})
