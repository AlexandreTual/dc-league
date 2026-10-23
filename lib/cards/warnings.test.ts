import { describe, it, expect } from 'vitest'
import { cardRow } from '@/test/factories'
import type { CardRow } from './types'
import { deckWarnings, warningText, type WarningCard } from './warnings'

function line(quantity: number, en: Partial<CardRow> | null, section: 'commander' | 'main' = 'main'): WarningCard {
  return { quantity, section, en: en ? cardRow(en) : null }
}

const kenrith = line(1, { name: 'Kenrith, the Returned King', type_line: 'Legendary Creature — Human Noble', color_identity: ['W', 'U', 'B', 'R', 'G'] }, 'commander')
const forest = (n: number) => line(n, { name: 'Forest', type_line: 'Basic Land — Forest', color_identity: ['G'] })

/** Deck conforme : un commandant, 63 cartes uniques, 36 forêts. */
function legalDeck(): WarningCard[] {
  return [
    kenrith,
    ...Array.from({ length: 63 }, (_, i) => line(1, { name: `Carte ${i}`, color_identity: ['G'] })),
    forest(36),
  ]
}

const name = (c: WarningCard) => c.en?.name ?? '?'

describe('deckWarnings', () => {
  it('deck conforme de 100 cartes : aucun avertissement', () => {
    expect(deckWarnings(legalDeck())).toEqual([])
  })

  it('deck vide : aucun avertissement', () => {
    expect(deckWarnings([])).toEqual([])
  })

  it('total différent de 100 (98 et 103)', () => {
    const short = legalDeck().slice(0, -1).concat(forest(34))
    expect(deckWarnings(short)).toEqual([{ kind: 'total', total: 98 }])
    const long = legalDeck().slice(0, -1).concat(forest(39))
    expect(warningText(deckWarnings(long)[0], name)).toBe('Le deck compte 103 cartes au lieu de 100.')
  })

  it('les cartes introuvables comptent dans le total', () => {
    const deck = legalDeck().slice(0, -1).concat(forest(35), line(1, null))
    expect(deckWarnings(deck)).toEqual([])
  })

  it('deux exemplaires d’une carte non basique, même sur deux lignes', () => {
    const deck = legalDeck().slice(0, -1).concat(forest(34), line(1, { name: 'Sol Ring', set_code: 'c21' }), line(1, { name: 'Sol Ring', set_code: 'cmr' }))
    const warnings = deckWarnings(deck)
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatchObject({ kind: 'duplicates', cards: [{ quantity: 2 }] })
    expect(warningText(warnings[0], name)).toBe("Plusieurs exemplaires d'une carte hors terrains de base : Sol Ring (×2).")
  })

  it('terrains de base (neigeux compris) et cartes « nombre illimité » : pas de doublon signalé', () => {
    const deck = [
      kenrith,
      ...Array.from({ length: 49 }, (_, i) => line(1, { name: `Carte ${i}` })),
      line(20, { name: 'Relentless Rats', type_line: 'Creature — Rat', oracle_text: 'Relentless Rats gets +1/+1 for each other creature you control named Relentless Rats.\nA deck can have any number of cards named Relentless Rats.' }),
      line(15, { name: 'Snow-Covered Island', type_line: 'Basic Snow Land — Island' }),
      line(15, { name: 'Wastes', type_line: 'Basic Land' }),
    ]
    expect(deckWarnings(deck)).toEqual([])
  })

  it('carte hors de l’identité couleur du commandant', () => {
    const mono = line(1, { name: 'Omnath, Locus of Mana', type_line: 'Legendary Creature — Elemental', color_identity: ['G'] }, 'commander')
    const deck = [mono, ...legalDeck().slice(1, -1), forest(35), line(1, { name: 'Counterspell', color_identity: ['U'] })]
    const warnings = deckWarnings(deck)
    expect(warnings).toHaveLength(1)
    expect(warningText(warnings[0], name)).toBe("Hors de l'identité couleur du commandant : Counterspell.")
  })

  it('deux commandants : identité réunie', () => {
    const tymna = line(1, { name: 'Tymna the Weaver', color_identity: ['W', 'B'] }, 'commander')
    const kraum = line(1, { name: 'Kraum, Ludevic’s Opus', color_identity: ['U', 'R'] }, 'commander')
    const deck = [tymna, kraum, ...Array.from({ length: 97 }, (_, i) => line(1, { name: `Carte ${i}`, color_identity: ['W', 'U', 'R'] })), line(1, { name: 'Forest', type_line: 'Basic Land — Forest', color_identity: ['G'] })]
    const warnings = deckWarnings(deck)
    expect(warnings).toHaveLength(1)
    expect(warningText(warnings[0], name)).toBe("Hors de l'identité couleur des commandants : Forest.")
  })

  it('sans commandant trouvé : identité non vérifiée', () => {
    const deck = [line(1, null, 'commander'), ...legalDeck().slice(1, -1), forest(35), line(1, { name: 'Counterspell', color_identity: ['U'] })]
    expect(deckWarnings(deck)).toEqual([])
  })
})
