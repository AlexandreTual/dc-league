import { describe, it, expect } from 'vitest'
import { testDeckCards } from '@/test/factories'
import { buildCatalog } from './catalog'
import { createInitialState } from './setup'
import { applyAction, cardData, taxOf } from './apply'
import type { GameAction, GameState, TokenData } from './types'

const { catalog } = buildCatalog('d1', testDeckCards())
const run = (...actions: GameAction[]): GameState =>
  actions.reduce((s, a) => applyAction(s, a, catalog), createInitialState(catalog))
const texts = (s: GameState) => s.log.map((l) => l.text)
const start = { type: 'start', seed: 1 } as const
const soldier: TokenData = { name: 'Soldat', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1', colors: ['W'], image: null }

describe('flip et faceDown', () => {
  it('retourne une carte à deux faces et change son image', () => {
    const s = run(start, { type: 'move', id: 'c4-1', to: 'battlefield' }, { type: 'flip', id: 'c4-1' })
    expect(s.cards['c4-1'].flipped).toBe(true)
    expect(cardData(s, catalog, 'c4-1', 'en')).toMatchObject({ image: 'back.jpg', name: 'Insectile Aberration' })
  })

  it('ne retourne pas une carte à une seule face', () => {
    const s = run(start, { type: 'move', id: 'c2-1', to: 'battlefield' }, { type: 'flip', id: 'c2-1' })
    expect(s.cards['c2-1'].flipped).toBe(false)
  })

  it('face cachée : carte masquée, et anonyme dans le journal', () => {
    let s = run(start, { type: 'move', id: 'c2-1', to: 'battlefield' }, { type: 'faceDown', id: 'c2-1' })
    expect(cardData(s, catalog, 'c2-1', 'fr').hidden).toBe(true)
    s = applyAction(s, { type: 'move', id: 'c2-1', to: 'exile' }, catalog)
    expect(texts(s).at(-1)).toBe('une carte : champ de bataille → exil')
  })

  it('faceDown ne vaut que sur le champ de bataille', () => {
    const s0 = run(start)
    const id = s0.zones.hand[0]
    expect(applyAction(s0, { type: 'faceDown', id }, catalog).cards[id].faceDown).toBe(false)
  })
})

describe('counter', () => {
  it('ajoute et borne à zéro', () => {
    let s = run(start, { type: 'move', id: 'c1-1', to: 'battlefield' }, { type: 'counter', id: 'c1-1', kind: 'plus', delta: 2 })
    expect(s.cards['c1-1'].counters.plus).toBe(2)
    expect(texts(s).at(-1)).toBe('Kenrith, the Returned King : +1/+1 (2)')
    s = applyAction(s, { type: 'counter', id: 'c1-1', kind: 'minus', delta: -5 }, catalog)
    expect(s.cards['c1-1'].counters.minus).toBe(0)
    s = applyAction(s, { type: 'counter', id: 'c1-1', kind: 'other', delta: 3 }, catalog)
    expect(texts(s).at(-1)).toBe('Kenrith, the Returned King : compteur (3)')
  })
})

describe('createToken', () => {
  it('crée des jetons numérotés sur le champ de bataille', () => {
    const s = run(start, { type: 'createToken', token: soldier, x: 20, y: 30 }, { type: 'createToken', token: soldier, x: 0, y: 0 })
    expect(s.zones.battlefield).toEqual(['t1', 't2'])
    expect(s.cards.t1).toMatchObject({ token: soldier, ref: null, x: 20, y: 30 })
    expect(s.nextTokenId).toBe(3)
    expect(texts(s).at(-1)).toBe('Crée un jeton Soldat')
  })

  it.each(['hand', 'graveyard', 'library'] as const)('un jeton envoyé vers %s disparaît', (to) => {
    const s = run(start, { type: 'createToken', token: soldier, x: 0, y: 0 }, { type: 'move', id: 't1', to })
    expect(s.cards.t1).toBeUndefined()
    expect(Object.values(s.zones).flat()).not.toContain('t1')
  })
})

describe('commanderTax', () => {
  it('ajuste la taxe sans descendre sous zéro', () => {
    let s = run(start, { type: 'commanderTax', id: 'c1-1', delta: 1 })
    expect(taxOf(s, 'c1-1')).toBe(2)
    s = applyAction(s, { type: 'commanderTax', id: 'c1-1', delta: -5 }, catalog)
    expect(taxOf(s, 'c1-1')).toBe(0)
  })
})

describe('reveal', () => {
  it('journalise la carte du dessus avec son nom français', () => {
    const s0 = run(start, { type: 'move', id: 'c2-1', to: 'library', position: 'top' })
    expect(texts(applyAction(s0, { type: 'reveal' }, catalog)).at(-1)).toBe('Révèle Anneau solaire')
  })

  it('signale une bibliothèque vide', () => {
    const s = run(start, { type: 'draw', count: 25 }, { type: 'reveal' })
    expect(texts(s).at(-1)).toBe('Bibliothèque vide')
  })
})
