import { describe, it, expect } from 'vitest'
import { cardRow, deckCardView } from '@/test/factories'
import { buildCatalog } from './catalog'
import { effectDelay, isLegendary } from './card-effects'
import type { Counters, TokenData, VisibleCard } from './types'

const face = (name: string, type: string) => ({
  name, printed_name: null, mana_cost: null, type_line: type, printed_type_line: null,
  oracle_text: null, printed_text: null, image_normal: null, image_small: null, power: null, toughness: null,
})

const { catalog } = buildCatalog('d', [
  deckCardView(1, cardRow({ id: 'edgar', name: 'Edgar Markov', type_line: 'Legendary Creature — Vampire Knight' })),
  deckCardView(2, cardRow({ id: 'elves', name: 'Llanowar Elves', type_line: 'Creature — Elf Druid' })),
  deckCardView(3, cardRow({
    id: 'delver', type_line: 'Creature — Human Wizard // Legendary Creature — Human Insect',
    faces: [face('Delver', 'Creature — Human Wizard'), face('Aberration', 'Legendary Creature — Human Insect')],
  })),
  deckCardView(4, cardRow({
    id: 'jace', type_line: 'Legendary Creature — Human Wizard // Legendary Planeswalker — Jace',
    faces: [face('Jace, Vryn’s Prodigy', 'Legendary Creature — Human Wizard'), face('Jace, Telepath Unbound', 'Legendary Planeswalker — Jace')],
  })),
])

const NONE: Counters = { plus: 0, minus: 0, other: 0 }
const onTable = (ref: number | null, extra: Partial<VisibleCard> = {}): VisibleCard => ({
  hidden: false, id: `c${ref}`, owner: 'p1', ref, token: null, isCommander: false,
  tapped: false, flipped: false, faceDown: false, counters: NONE, x: 50, y: 50, ...extra,
})
const token = (typeLine: string): TokenData => ({ name: 'Jeton', typeLine, power: null, toughness: null, colors: [], image: null })

describe('isLegendary', () => {
  it('ligne de type de la face visible', () => {
    expect(isLegendary(catalog, onTable(1))).toBe(true)
    expect(isLegendary(catalog, onTable(2))).toBe(false)
    expect(isLegendary(catalog, onTable(1, { tapped: true }))).toBe(true)
  })

  it('carte à deux faces : seulement la face montrée', () => {
    expect(isLegendary(catalog, onTable(3))).toBe(false)
    expect(isLegendary(catalog, onTable(3, { flipped: true }))).toBe(true)
    expect(isLegendary(catalog, onTable(4))).toBe(true)
    expect(isLegendary(catalog, onTable(4, { flipped: true }))).toBe(true)
  })

  it('jeton : sa ligne de type', () => {
    expect(isLegendary(catalog, onTable(null, { token: token('Legendary Token Creature — Construct') }))).toBe(true)
    expect(isLegendary(catalog, onTable(null, { token: token('Token Creature — Soldat') }))).toBe(false)
  })

  it('jamais pour une carte face cachée, inconnue ou sans catalogue', () => {
    expect(isLegendary(catalog, onTable(1, { faceDown: true }))).toBe(false)
    expect(isLegendary(catalog, onTable(99))).toBe(false)
    expect(isLegendary(undefined, onTable(1))).toBe(false)
  })
})

describe('effectDelay', () => {
  it('décalage stable, négatif, de moins de 7 s, propre à chaque carte', () => {
    expect(effectDelay('c1')).toBe(effectDelay('c1'))
    const delays = ['c1', 'c2', 'c3', 'p1-17', 'p2-4'].map(effectDelay)
    for (const d of delays) expect(d).toMatch(/^-\d(\.\d)?s$/)
    expect(new Set(delays).size).toBeGreaterThan(1)
  })
})
