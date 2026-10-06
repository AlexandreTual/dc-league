// Cas repris de l'ancien moteur solo, joués à un seul joueur sur le nouveau moteur.
import { describe, it, expect } from 'vitest'
import { card, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction, cardData, tokenBadge } from './apply'
import { zoneOf } from './rules'
import type { GameAction, GameState, TokenData } from './types'

const P = 'p1'
const solo = (...actions: GameAction[]) => actions.reduce(applyAction, run(setupFor('commander', 1), start(1)))
const zones = (s: GameState) => s.players[P].zones
const texts = (s: GameState) => s.log.map((l) => l.text)
const total = (s: GameState) => Object.values(zones(s)).reduce((n, z) => n + z.length, 0)
const occurrences = (s: GameState, id: string) => Object.values(zones(s)).flat().filter((x) => x === id).length
const to = (zone: 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command') => ({ player: P, zone })
const mv = (id: string, zone: Parameters<typeof to>[0], extra: Partial<Extract<GameAction, { type: 'move' }>> = {}): GameAction =>
  ({ type: 'move', actor: P, id, to: to(zone), ...extra })
const sol = card(P, 2)
const kenrith = card(P, 1)
const delver = card(P, 4)
const soldier: TokenData = { name: 'Soldat', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1', colors: ['W'], image: null }

describe('start et pioche', () => {
  it('start est déterministe pour une graine', () => {
    const s = solo()
    expect(run(setupFor('commander', 1), start(1)).players[P].zones.hand).toEqual(zones(s).hand)
    expect(run(setupFor('commander', 1), start(2)).players[P].zones.hand).not.toEqual(zones(s).hand)
  })

  it('pioche depuis le dessus', () => {
    const before = solo()
    const s = applyAction(before, { type: 'draw', actor: P, count: 2 })
    expect(zones(s).hand).toEqual([...zones(before).hand, ...zones(before).library.slice(0, 2)])
    expect(s.players[P].stats.drawn).toBe(9)
    expect(texts(s).at(-1)).toBe('Pioche 2 cartes')
  })

  it('bibliothèque vide : ne fait que le signaler', () => {
    const empty = solo({ type: 'draw', actor: P, count: 25 })
    const s = applyAction(empty, { type: 'draw', actor: P, count: 1 })
    expect(zones(s)).toEqual(zones(empty))
    expect(texts(s).at(-1)).toBe('Bibliothèque vide')
  })

  it('mulligans comptés, sans nombre de cartes à mettre dessous dans le journal', () => {
    const first = solo({ type: 'mulligan', actor: P, seed: 9 })
    expect(total(first)).toBe(total(solo()))
    expect(texts(first).at(-1)).toBe('Mulligan n°1')
    const second = applyAction(first, { type: 'mulligan', actor: P, seed: 10 })
    expect(second.players[P].mulligans).toBe(2)
    expect(texts(second).at(-1)).toBe('Mulligan n°2')
  })

  it('endTurn en solo : tour suivant, dégagement et pioche', () => {
    const s0 = solo(mv(sol, 'battlefield'), { type: 'tap', actor: P, id: sol })
    const s = applyAction(s0, { type: 'endTurn', actor: P })
    expect(s.turn).toBe(2)
    expect(s.cards[sol].tapped).toBe(false)
    expect(zones(s).hand).toHaveLength(zones(s0).hand.length + 1)
    expect(s.log.at(-1)).toMatchObject({ turn: 2, text: 'Tour 2 : Alex' })
  })
})

describe('move', () => {
  it('bibliothèque : dessous journalisé, index précis', () => {
    const s0 = solo()
    const [a, b] = zones(s0).hand
    const s1 = applyAction(s0, mv(a, 'library', { position: 'bottom' }))
    expect(texts(s1).at(-1)).toBe('une carte : main → bibliothèque (dessous)')
    const s2 = applyAction(s0, mv(b, 'library', { position: 2 }))
    expect(zones(s2).library[2]).toBe(b)
  })

  it('repositionnement sur le champ de bataille sans doublon ni perte', () => {
    const s0 = solo()
    const id = zones(s0).hand[0]
    const s = solo(mv(id, 'battlefield', { x: 10, y: 10 }), mv(id, 'battlefield', { x: 70, y: 20 }))
    expect(occurrences(s, id)).toBe(1)
    expect(s.cards[id]).toMatchObject({ x: 70, y: 20 })
    expect(total(s)).toBe(total(s0))
  })

  it('position bornée et nom français dans le journal', () => {
    const s = solo(mv(sol, 'battlefield', { x: 150, y: -5 }))
    expect(s.cards[sol]).toMatchObject({ x: 100, y: 0 })
    expect(texts(s).at(-1)).toMatch(/^Anneau solaire : .* → champ de bataille$/)
  })

  it('un terrain ne compte que posé depuis la main', () => {
    const s0 = solo()
    const forest = Object.keys(s0.cards).find((id) => id.startsWith(`${P}:c3-`) && !zones(s0).hand.includes(id))!
    expect(applyAction(applyAction(s0, mv(forest, 'graveyard')), mv(forest, 'battlefield')).players[P].stats.landsPlayed).toBe(0)
    expect(applyAction(applyAction(s0, mv(forest, 'hand')), mv(forest, 'battlefield')).players[P].stats.landsPlayed).toBe(1)
  })

  it('remet à zéro une carte qui quitte le champ de bataille', () => {
    let s = solo(mv(delver, 'battlefield'), { type: 'tap', actor: P, id: delver }, { type: 'flip', actor: P, id: delver })
    s = applyAction(s, { type: 'counter', actor: P, id: delver, kind: 'plus', delta: 2 })
    s = applyAction(s, mv(delver, 'graveyard'))
    expect(s.cards[delver]).toMatchObject({ tapped: false, flipped: false, faceDown: false, counters: { plus: 0, minus: 0, other: 0 } })
  })

  it('compte les lancements du commandant à l’aller seulement', () => {
    let s = solo(mv(kenrith, 'battlefield'), mv(kenrith, 'command'))
    expect(s.commanderCasts[kenrith]).toBe(1)
    s = applyAction(s, mv(kenrith, 'battlefield'))
    expect(s.commanderCasts[kenrith]).toBe(2)
  })

  it('refuse une carte inconnue', () => {
    const s0 = solo()
    expect(applyAction(s0, mv('zzz', 'hand'))).toBe(s0)
  })
})

describe('cartes', () => {
  it('tap ne vaut que sur le champ de bataille', () => {
    const s0 = solo()
    expect(applyAction(s0, { type: 'tap', actor: P, id: zones(s0).hand[0] })).toBe(s0)
  })

  it('retourne une carte à deux faces, pas une carte à une seule face', () => {
    const s = solo(mv(delver, 'battlefield'), { type: 'flip', actor: P, id: delver })
    expect(cardData(s, delver, 'en')).toMatchObject({ image: 'back.jpg', name: 'Insectile Aberration' })
    const one = solo(mv(sol, 'battlefield'))
    expect(applyAction(one, { type: 'flip', actor: P, id: sol })).toBe(one)
  })

  it('face cachée : masquée, et anonyme dans le journal en quittant le champ de bataille', () => {
    let s = solo(mv(sol, 'battlefield'), { type: 'faceDown', actor: P, id: sol })
    expect(cardData(s, sol, 'fr').hidden).toBe(true)
    s = applyAction(s, mv(sol, 'exile'))
    expect(texts(s).at(-1)).toBe('une carte : champ de bataille → exil')
  })

  it('faceDown ne vaut que sur le champ de bataille', () => {
    const s0 = solo()
    expect(applyAction(s0, { type: 'faceDown', actor: P, id: zones(s0).hand[0] })).toBe(s0)
  })

  it('marqueurs : journal en français', () => {
    let s = solo(mv(kenrith, 'battlefield'), { type: 'counter', actor: P, id: kenrith, kind: 'plus', delta: 2 })
    expect(texts(s).at(-1)).toBe('Kenrith, the Returned King : +1/+1 (2)')
    s = applyAction(s, { type: 'counter', actor: P, id: kenrith, kind: 'other', delta: 3 })
    expect(texts(s).at(-1)).toBe('Kenrith, the Returned King : compteur (3)')
  })

  it('jetons numérotés', () => {
    const s = solo({ type: 'createToken', actor: P, token: soldier, x: 20, y: 30 }, { type: 'createToken', actor: P, token: soldier, x: 0, y: 0 })
    expect(zones(s).battlefield).toEqual(['t1', 't2'])
    expect(s.cards.t1).toMatchObject({ token: soldier, ref: null, x: 20, y: 30, owner: P })
    expect(s.nextTokenId).toBe(3)
    expect(texts(s).at(-1)).toBe('Crée un jeton Soldat')
  })

  it('jeton copie : signalé dans le journal', () => {
    const forest: TokenData = { name: 'Forêt', typeLine: 'Basic Land — Forest', power: null, toughness: null, colors: [], image: null }
    const s = solo({ type: 'createToken', actor: P, token: forest, x: 0, y: 0, copy: true })
    expect(texts(s).at(-1)).toBe('Crée un jeton Forêt (copie)')
    expect(s.cards.t1.token).toEqual({ ...forest, copy: true })
  })

  it('mention affichée : « Copie » pour un jeton copie, « Jeton » pour les autres jetons, rien pour une carte', () => {
    const forest: TokenData = { name: 'Forêt', typeLine: 'Basic Land — Forest', power: null, toughness: null, colors: [], image: null }
    const s = solo({ type: 'createToken', actor: P, token: forest, x: 0, y: 0, copy: true }, { type: 'createToken', actor: P, token: soldier, x: 0, y: 0 })
    expect(tokenBadge(s.cards.t1)).toBe('Copie')
    expect(tokenBadge(s.cards.t2)).toBe('Jeton')
    expect(tokenBadge(s.cards[sol])).toBeNull()
  })

  it.each(['hand', 'graveyard', 'library'] as const)('un jeton envoyé vers %s disparaît', (zone) => {
    const s = solo({ type: 'createToken', actor: P, token: soldier, x: 0, y: 0 }, mv('t1', zone))
    expect(s.cards.t1).toBeUndefined()
    expect(zoneOf(s, 't1')).toBeNull()
  })

  it('révèle la carte du dessus avec son nom français, ou signale une bibliothèque vide', () => {
    expect(texts(solo(mv(sol, 'library', { position: 'top' }), { type: 'revealTop', actor: P })).at(-1)).toBe('révèle Anneau solaire')
    expect(texts(solo({ type: 'draw', actor: P, count: 25 }, { type: 'revealTop', actor: P })).at(-1)).toBe('Bibliothèque vide')
  })
})
