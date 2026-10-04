import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { zoneOf } from './rules'
import type { GameAction, GameState } from './types'

const sol = (p: string) => card(p, 2)
const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const texts = (s: GameState) => s.log.map((l) => l.text)

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.values(o).forEach(deepFreeze)
    Object.freeze(o)
  }
  return o
}

/** Partie à 4 joueurs démarrée et dont chaque main est gardée. */
function kept4(): GameState {
  const s = run(setupFor('commander', 4), start(1))
  return apply(s, ...s.turnOrder.map((p) => ({ type: 'keep', actor: p }) as GameAction))
}

describe('immuabilité et refus', () => {
  it('ne modifie pas l’état reçu', () => {
    const s = deepFreeze(run(setupFor('commander', 2), start()))
    expect(() => applyAction(s, { type: 'draw', actor: 'p1', count: 1 })).not.toThrow()
    expect(() => applyAction(s, { type: 'move', actor: 'p1', id: s.players.p1.zones.hand[0], to: { player: 'p1', zone: 'battlefield' } })).not.toThrow()
  })

  it('renvoie le même état pour une action refusée', () => {
    const s = run(setupFor('commander', 2), start())
    expect(applyAction(s, { type: 'endTurn', actor: s.turnOrder[1] })).toBe(s)
  })
})

describe('start, mulligan, keep', () => {
  it('pioche 7 pour chacun et tire l’ordre du tour', () => {
    const s = run(setupFor('commander', 4), start(1))
    for (const p of Object.values(s.players)) {
      expect(p.zones.hand).toHaveLength(7)
      expect(p.zones.library).toHaveLength(25)
      expect(p.stats.drawn).toBe(7)
    }
    expect([...s.turnOrder].sort()).toEqual(['p1', 'p2', 'p3', 'p4'])
    expect(s.activePlayer).toBe(s.turnOrder[0])
    expect(s.started).toBe(true)
    expect(run(setupFor('commander', 4), start(1))).toEqual(s)
    expect(s.log.at(-1)).toMatchObject({ actor: null, text: `Début de partie : ${s.players[s.turnOrder[0]].name} commence`, visibleTo: 'all' })
  })

  it('mulligan par joueur, puis keep', () => {
    const s0 = run(setupFor('commander', 2), start(1))
    const s1 = applyAction(s0, { type: 'mulligan', actor: 'p2', seed: 9 })
    expect(s1.players.p2.zones.hand).toHaveLength(7)
    expect(s1.players.p2.zones.hand).not.toEqual(s0.players.p2.zones.hand)
    expect(s1.players.p2.mulligans).toBe(1)
    expect(s1.players.p1).toEqual(s0.players.p1)
    const s2 = applyAction(s1, { type: 'keep', actor: 'p2' })
    expect(s2.players.p2.kept).toBe(true)
    expect(applyAction(s2, { type: 'mulligan', actor: 'p2', seed: 3 })).toBe(s2)
  })

  it('à 3 joueurs ou plus, le premier joueur pioche en gardant sa main', () => {
    const s = run(setupFor('commander', 3), start(1))
    const first = s.turnOrder[0]
    const kept = applyAction(s, { type: 'keep', actor: first })
    expect(kept.players[first].zones.hand).toHaveLength(8)
    const other = s.turnOrder[1]
    expect(applyAction(s, { type: 'keep', actor: other }).players[other].zones.hand).toHaveLength(7)
  })

  it('à 2 joueurs ou seul, le premier joueur ne pioche pas', () => {
    const duel = run(setupFor('duel', 2), start(1))
    expect(applyAction(duel, { type: 'keep', actor: duel.turnOrder[0] }).players[duel.turnOrder[0]].zones.hand).toHaveLength(7)
    const solo = run(setupFor('commander', 1), start(1))
    expect(applyAction(solo, { type: 'keep', actor: 'p1' }).players.p1.zones.hand).toHaveLength(7)
  })
})

describe('endTurn', () => {
  it('passe au suivant, qui dégage et pioche, et compte les tours de table', () => {
    let s = kept4()
    const [a, b] = s.turnOrder
    const land = s.players[b].zones.hand[0]
    s = apply(s, { type: 'move', actor: b, id: land, to: { player: b, zone: 'battlefield' } }, { type: 'tap', actor: b, id: land })
    const handB = s.players[b].zones.hand.length
    s = applyAction(s, { type: 'endTurn', actor: a })
    expect(s.activePlayer).toBe(b)
    expect(s.cards[land].tapped).toBe(false)
    expect(s.players[b].zones.hand).toHaveLength(handB + 1)
    expect(s.turn).toBe(1)
    expect(texts(s).at(-1)).toBe(`Tour 1 : ${s.players[b].name}`)
    for (const p of s.turnOrder.slice(1)) s = applyAction(s, { type: 'endTurn', actor: p })
    expect(s.activePlayer).toBe(a)
    expect(s.turn).toBe(2)
  })

  it('saute les joueurs éliminés', () => {
    let s = kept4()
    const [a, b, c] = s.turnOrder
    s = applyAction(s, { type: 'eliminate', actor: a, target: b })
    s = applyAction(s, { type: 'endTurn', actor: a })
    expect(s.activePlayer).toBe(c)
  })

  it('un joueur éliminé pendant son tour passe la main sans piocher', () => {
    let s = kept4()
    const [a, b] = s.turnOrder
    const handA = s.players[a].zones.hand.length
    const handB = s.players[b].zones.hand.length
    s = applyAction(s, { type: 'eliminate', actor: a, target: a })
    expect(s.players[a].eliminated).toBe(true)
    expect(s.activePlayer).toBe(b)
    expect(s.players[a].zones.hand).toHaveLength(handA)
    expect(s.players[b].zones.hand).toHaveLength(handB + 1)
  })
})

describe('move', () => {
  const base = () => place(kept4(), [{ id: sol('p2'), player: 'p2', zone: 'graveyard' }])

  it('réanime depuis le cimetière d’un adversaire', () => {
    const s = applyAction(base(), { type: 'move', actor: 'p1', id: sol('p2'), to: { player: 'p1', zone: 'battlefield' }, x: 30, y: 40 })
    expect(zoneOf(s, sol('p2'))).toEqual({ player: 'p1', zone: 'battlefield' })
    expect(s.cards[sol('p2')]).toMatchObject({ owner: 'p2', x: 30, y: 40 })
    expect(texts(s).at(-1)).toBe('Anneau solaire : cimetière de Bob → champ de bataille')
  })

  it('une carte volée qui meurt va au cimetière de son propriétaire', () => {
    let s = applyAction(base(), { type: 'move', actor: 'p1', id: sol('p2'), to: { player: 'p1', zone: 'battlefield' } })
    s = applyAction(s, { type: 'tap', actor: 'p1', id: sol('p2') })
    s = applyAction(s, { type: 'move', actor: 'p1', id: sol('p2'), to: { player: 'p2', zone: 'graveyard' } })
    expect(zoneOf(s, sol('p2'))).toEqual({ player: 'p2', zone: 'graveyard' })
    expect(s.cards[sol('p2')].tapped).toBe(false)
  })

  it('dessus, dessous et même zone sans doublon', () => {
    const s0 = kept4()
    const top = s0.players.p1.zones.library[0]
    const s1 = applyAction(s0, { type: 'move', actor: 'p1', id: top, to: { player: 'p1', zone: 'library' }, position: 'bottom' })
    expect(s1.players.p1.zones.library.at(-1)).toBe(top)
    expect(s1.players.p1.zones.library).toHaveLength(s0.players.p1.zones.library.length)
    const inHand = s0.players.p1.zones.hand[0]
    const s2 = applyAction(s0, { type: 'move', actor: 'p1', id: inHand, to: { player: 'p1', zone: 'library' } })
    expect(s2.players.p1.zones.library[0]).toBe(inHand)
    expect(texts(s2).at(-1)).toBe('une carte : main → bibliothèque (dessus)')
  })

  it('jeton hors du champ de bataille, taxe, terrain joué', () => {
    let s = kept4()
    s = applyAction(s, { type: 'createToken', actor: 'p1', token: { name: 'Soldat', typeLine: 'Token Creature — Soldat', power: '1', toughness: '1', colors: [], image: null }, x: 0, y: 0 })
    s = applyAction(s, { type: 'move', actor: 'p1', id: 't1', to: { player: 'p1', zone: 'hand' } })
    expect(s.cards.t1).toBeUndefined()

    s = applyAction(s, { type: 'move', actor: 'p1', id: card('p1', 1), to: { player: 'p1', zone: 'battlefield' } })
    expect(s.commanderCasts[card('p1', 1)]).toBe(1)

    const forest = Object.keys(s.cards).find((id) => id.startsWith('p1:c3-'))!
    s = place(s, [{ id: forest, player: 'p1', zone: 'hand' }])
    s = applyAction(s, { type: 'move', actor: 'p1', id: forest, to: { player: 'p1', zone: 'battlefield' } })
    expect(s.players.p1.stats.landsPlayed).toBe(1)
  })

  it('exil face cachée : seul l’auteur la connaît', () => {
    const s = applyAction(base(), { type: 'move', actor: 'p1', id: sol('p2'), to: { player: 'p2', zone: 'exile' }, faceDown: true })
    expect(s.cards[sol('p2')]).toMatchObject({ faceDown: true, knownBy: ['p1'] })
    expect(texts(s).at(-1)).toBe('une carte : cimetière de Bob → exil de Bob')
  })
})

describe('giveControl', () => {
  it('donne la carte avec son état', () => {
    let s = place(kept4(), [{ id: sol('p1'), player: 'p1', zone: 'battlefield' }])
    s = apply(s, { type: 'tap', actor: 'p1', id: sol('p1') }, { type: 'counter', actor: 'p1', id: sol('p1'), kind: 'plus', delta: 2 })
    s = applyAction(s, { type: 'giveControl', actor: 'p1', id: sol('p1'), to: 'p3' })
    expect(zoneOf(s, sol('p1'))).toEqual({ player: 'p3', zone: 'battlefield' })
    expect(s.cards[sol('p1')]).toMatchObject({ tapped: true, counters: { plus: 2 }, owner: 'p1' })
    expect(texts(s).at(-1)).toBe('donne le contrôle de Anneau solaire à Chloé')
  })
})
