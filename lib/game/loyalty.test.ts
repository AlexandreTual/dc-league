import { describe, it, expect } from 'vitest'
import { cardRow, deckCardView } from '@/test/factories'
import { buildCatalog } from './catalog'
import { baseLoyalty, clampLoyalty, hasLoyalty, loyaltyStats } from './loyalty'
import type { Counters, TokenData, VisibleCard } from './types'

const face = (name: string, type: string, loyalty?: string | null) => ({
  name, printed_name: null, mana_cost: null, type_line: type, printed_type_line: null,
  oracle_text: null, printed_text: null, image_normal: null, image_small: null, power: null, toughness: null,
  ...(loyalty === undefined ? {} : { loyalty }),
})

const { catalog } = buildCatalog('d', [
  deckCardView(1, cardRow({ id: 'teferi', name: 'Teferi, Time Raveler', type_line: 'Legendary Planeswalker — Teferi', loyalty: '4' })),
  deckCardView(2, cardRow({ id: 'sol', loyalty: null })),
  deckCardView(3, cardRow({ id: 'old', name: 'Old Walker', type_line: 'Legendary Planeswalker — Jace' })),
  deckCardView(4, cardRow({
    id: 'jace', type_line: 'Legendary Creature — Human Wizard // Legendary Planeswalker — Jace', power: '0', toughness: '2', loyalty: null,
    faces: [face('Jace, Vryn’s Prodigy', 'Legendary Creature — Human Wizard', null), face('Jace, Telepath Unbound', 'Legendary Planeswalker — Jace', '5')],
  })),
  deckCardView(5, cardRow({ id: 'nissa', type_line: 'Legendary Planeswalker — Nissa', loyalty: 'X' })),
])

const NONE: Counters = { plus: 0, minus: 0, other: 0 }
const onTable = (ref: number | null, extra: Partial<VisibleCard> = {}): VisibleCard => ({
  hidden: false, id: `c${ref}`, owner: 'p1', ref, token: null, isCommander: false,
  tapped: false, flipped: false, faceDown: false, counters: NONE, x: 50, y: 50, ...extra,
})
const soldier: TokenData = { name: 'Soldat', typeLine: 'Token Creature — Soldat', power: '1', toughness: '1', colors: [], image: null }

describe('baseLoyalty', () => {
  it('loyauté imprimée, celle du verso une fois transformée', () => {
    expect(baseLoyalty(catalog, onTable(1))).toBe('4')
    expect(baseLoyalty(catalog, onTable(4))).toBeNull()
    expect(baseLoyalty(catalog, onTable(4, { flipped: true }))).toBe('5')
  })

  it('aucune : carte sans loyauté, pas encore relue, face cachée, jeton, carte inconnue', () => {
    expect(baseLoyalty(catalog, onTable(2))).toBeNull()
    expect(baseLoyalty(catalog, onTable(3))).toBeNull()
    expect(baseLoyalty(catalog, onTable(1, { faceDown: true }))).toBeNull()
    expect(baseLoyalty(catalog, onTable(null, { token: soldier }))).toBeNull()
    expect(baseLoyalty(catalog, onTable(99))).toBeNull()
    expect(baseLoyalty(undefined, onTable(1))).toBeNull()
  })
})

describe('loyaltyStats', () => {
  it('loyauté imprimée plus l’écart', () => {
    expect(loyaltyStats(catalog, onTable(1))).toEqual({ text: '4', delta: 0, value: 4 })
    expect(loyaltyStats(catalog, onTable(1, { loyaltyMod: 2 }))).toEqual({ text: '6', delta: 2, value: 6 })
    expect(loyaltyStats(catalog, onTable(1, { loyaltyMod: -3 }))).toEqual({ text: '1', delta: -3, value: 1 })
  })

  it('loyauté non numérique : écart accolé ; inconnue : l’écart seul, rien sans écart', () => {
    expect(loyaltyStats(catalog, onTable(5, { loyaltyMod: 3 }))).toEqual({ text: 'X+3', delta: 3, value: null })
    expect(loyaltyStats(catalog, onTable(3))).toBeNull()
    expect(loyaltyStats(catalog, onTable(3, { loyaltyMod: 2 }))).toEqual({ text: '+2', delta: 2, value: null })
    expect(loyaltyStats(catalog, onTable(2))).toBeNull()
    expect(loyaltyStats(catalog, onTable(1, { faceDown: true, loyaltyMod: 2 }))).toBeNull()
  })
})

describe('hasLoyalty', () => {
  it('planeswalker (loyauté connue ou pas encore lue), carte déjà modifiée', () => {
    expect(hasLoyalty(catalog, onTable(1))).toBe(true)
    expect(hasLoyalty(catalog, onTable(3))).toBe(true)
    expect(hasLoyalty(catalog, onTable(4, { flipped: true }))).toBe(true)
    expect(hasLoyalty(catalog, onTable(2, { loyaltyMod: 1 }))).toBe(true)
  })

  it('pas de loyauté : autre carte, recto créature, face cachée', () => {
    expect(hasLoyalty(catalog, onTable(2))).toBe(false)
    expect(hasLoyalty(catalog, onTable(4))).toBe(false)
    expect(hasLoyalty(catalog, onTable(1, { faceDown: true }))).toBe(false)
  })
})

describe('clampLoyalty', () => {
  it('jamais sous 0 marqueur avec une loyauté numérique, borné à ±999 sinon', () => {
    expect(clampLoyalty('4', -10)).toBe(-4)
    expect(clampLoyalty('4', 5000)).toBe(999)
    expect(clampLoyalty('X', -10)).toBe(-10)
    expect(clampLoyalty(null, -5000)).toBe(-999)
  })
})
