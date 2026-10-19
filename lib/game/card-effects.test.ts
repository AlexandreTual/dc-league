import { describe, it, expect } from 'vitest'
import { cardRow, deckCardView } from '@/test/factories'
import { buildCatalog } from './catalog'
import { effectDelay, enteredBattlefield, hasFlying, isLegendary } from './card-effects'
import type { CardView, Counters, PlayerView, TokenData, VisibleCard } from './types'

const face = (name: string, type: string) => ({
  name, printed_name: null, mana_cost: null, type_line: type, printed_type_line: null,
  oracle_text: null, printed_text: null, image_normal: null, image_small: null, power: null, toughness: null,
})

const { catalog } = buildCatalog('d', [
  deckCardView(1, cardRow({ id: 'edgar', name: 'Edgar Markov', type_line: 'Legendary Creature — Vampire Knight' })),
  deckCardView(2, cardRow({ id: 'elves', name: 'Llanowar Elves', type_line: 'Creature — Elf Druid' })),
  deckCardView(3, cardRow({
    id: 'delver', type_line: 'Creature — Human Wizard // Legendary Creature — Human Insect',
    faces: [face('Delver', 'Creature — Human Wizard'), { ...face('Aberration', 'Legendary Creature — Human Insect'), keywords: ['Flying'] }],
  })),
  deckCardView(5, cardRow({ id: 'angel', name: 'Serra Angel', type_line: 'Creature — Angel', keywords: ['Flying', 'Vigilance'] })),
  deckCardView(6, cardRow({ id: 'old', name: 'Old Angel', type_line: 'Creature — Angel', keywords: undefined })),
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

/** Vue réduite aux champs de bataille, seule partie lue par `enteredBattlefield`. */
const viewWith = (fields: Record<string, CardView[]>) =>
  ({ players: Object.fromEntries(Object.entries(fields).map(([p, battlefield]) => [p, { zones: { battlefield } }])) }) as unknown as PlayerView

describe('hasFlying', () => {
  it('vol imprimé sur la face montrée', () => {
    expect(hasFlying(catalog, onTable(5))).toBe(true)
    expect(hasFlying(catalog, onTable(5, { tapped: true }))).toBe(true)
    expect(hasFlying(catalog, onTable(1))).toBe(false)
    expect(hasFlying(catalog, onTable(3))).toBe(false)
    expect(hasFlying(catalog, onTable(3, { flipped: true }))).toBe(true)
  })

  it('jeton : ses capacités ; aucune connue (carte pas encore relue, ancien serveur), face cachée ou inconnue : non', () => {
    expect(hasFlying(catalog, onTable(null, { token: { ...token('Token Creature — Spirit'), keywords: ['Flying'] } }))).toBe(true)
    expect(hasFlying(catalog, onTable(null, { token: token('Token Creature — Spirit') }))).toBe(false)
    expect(hasFlying(catalog, onTable(6))).toBe(false)
    expect(hasFlying(catalog, onTable(5, { faceDown: true }))).toBe(false)
    expect(hasFlying(catalog, onTable(99))).toBe(false)
    expect(hasFlying(undefined, onTable(5))).toBe(false)
  })
})

describe('effectDelay', () => {
  it('décalage stable, négatif, de moins d’un aller-retour (3,2 s), propre à chaque carte', () => {
    expect(effectDelay('c1')).toBe(effectDelay('c1'))
    const delays = ['c1', 'c2', 'c3', 'p1:c4-1', 'p2:c4-1'].map(effectDelay)
    for (const d of delays) expect(d).toMatch(/^-(\d|[0-2]\.\d|3\.[01])s$/)
    expect(new Set(delays).size).toBeGreaterThan(1)
  })
})

describe('enteredBattlefield', () => {
  it('cartes arrivées sur un champ de bataille depuis la vue précédente, chez tous les joueurs', () => {
    const before = viewWith({ p1: [onTable(1)], p2: [] })
    const after = viewWith({ p1: [onTable(1), onTable(2)], p2: [onTable(3)] })
    expect(enteredBattlefield(before, after).sort()).toEqual(['c2', 'c3'])
  })

  it('rien au premier affichage (chargement, reprise, nouvelle fenêtre)', () => {
    expect(enteredBattlefield(null, viewWith({ p1: [onTable(1)] }))).toEqual([])
  })

  it('carte déjà là (engagée, déplacée) : pas une arrivée ; revenue après l’avoir quitté : arrivée', () => {
    const before = viewWith({ p1: [onTable(1)] })
    expect(enteredBattlefield(before, viewWith({ p1: [onTable(1, { tapped: true, x: 10 })] }))).toEqual([])
    const left = viewWith({ p1: [] })
    expect(enteredBattlefield(left, viewWith({ p1: [onTable(1)] }))).toEqual(['c1'])
  })

  it('ignore les cartes cachées', () => {
    expect(enteredBattlefield(viewWith({ p1: [] }), viewWith({ p1: [{ hidden: true }] }))).toEqual([])
  })
})
