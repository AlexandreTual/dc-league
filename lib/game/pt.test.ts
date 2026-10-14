import { describe, it, expect } from 'vitest'
import { cardRow, deckCardView } from '@/test/factories'
import { buildCatalog } from './catalog'
import { basePT, ptLog, ptStats, signed } from './pt'
import type { Counters, TokenData, VisibleCard } from './types'

const face = (name: string, power: string | null | undefined, toughness: string | null | undefined) => ({
  name, printed_name: null, mana_cost: null, type_line: 'Creature', printed_type_line: null,
  oracle_text: null, printed_text: null, image_normal: null, image_small: null,
  ...(power === undefined ? {} : { power, toughness }),
})

const { catalog } = buildCatalog('d', [
  deckCardView(1, cardRow({ id: 'bear', name: 'Grizzly Bears', type_line: 'Creature — Bear', power: '2', toughness: '2' })),
  deckCardView(2, cardRow({ id: 'sol', power: null, toughness: null })),
  deckCardView(3, cardRow({ id: 'old', name: 'Old Bear', type_line: 'Creature — Bear' })),
  deckCardView(4, cardRow({
    id: 'delver', type_line: 'Creature // Creature', power: '1', toughness: '1',
    faces: [face('Delver of Secrets', '1', '1'), face('Insectile Aberration', '3', '2')],
  })),
  deckCardView(5, cardRow({ id: 'tarmo', name: 'Tarmogoyf', type_line: 'Creature — Lhurgoyf', power: '*', toughness: '1+*' })),
  deckCardView(6, cardRow({
    id: 'old-dfc', type_line: 'Creature // Creature', power: '1', toughness: '1',
    faces: [face('Recto', undefined, undefined), face('Verso', undefined, undefined)],
  })),
])

const NONE: Counters = { plus: 0, minus: 0, other: 0 }
const onTable = (ref: number | null, extra: Partial<VisibleCard> = {}): VisibleCard => ({
  hidden: false, id: `c${ref}`, owner: 'p1', ref, token: null, isCommander: false,
  tapped: false, flipped: false, faceDown: false, counters: NONE, x: 50, y: 50, ...extra,
})
const soldier: TokenData = { name: 'Soldat', typeLine: 'Token Creature — Soldat', power: '1', toughness: '1', colors: [], image: null }

describe('basePT', () => {
  it('force et endurance imprimées, du verso une fois transformée', () => {
    expect(basePT(catalog, onTable(1))).toEqual({ power: '2', toughness: '2' })
    expect(basePT(catalog, onTable(4))).toEqual({ power: '1', toughness: '1' })
    expect(basePT(catalog, onTable(4, { flipped: true }))).toEqual({ power: '3', toughness: '2' })
  })

  it('jeton : la sienne ; face cachée : 2/2', () => {
    expect(basePT(catalog, onTable(null, { token: soldier }))).toEqual({ power: '1', toughness: '1' })
    expect(basePT(catalog, onTable(null, { token: { ...soldier, power: null, toughness: null } }))).toBeNull()
    expect(basePT(catalog, onTable(2, { faceDown: true }))).toEqual({ power: '2', toughness: '2' })
  })

  it('aucune : carte sans force, carte pas encore relue, verso inconnu, carte inconnue', () => {
    expect(basePT(catalog, onTable(2))).toBeNull()
    expect(basePT(catalog, onTable(3))).toBeNull()
    expect(basePT(catalog, onTable(6, { flipped: true }))).toBeNull()
    expect(basePT(undefined, onTable(1))).toBeNull()
  })
})

describe('ptStats', () => {
  it('base + marqueurs + modification, chaque valeur avec son écart', () => {
    const card = onTable(1, { counters: { plus: 2, minus: 1, other: 3 }, ptMod: { power: 3, toughness: -2 } })
    expect(ptStats(catalog, card)).toEqual({
      power: { text: '6', delta: 4, value: 6 },
      toughness: { text: '1', delta: -1, value: 1 },
      base: true,
    })
  })

  it('créature sans modification : sa force imprimée', () => {
    expect(ptStats(catalog, onTable(1))).toEqual({ power: { text: '2', delta: 0, value: 2 }, toughness: { text: '2', delta: 0, value: 2 }, base: true })
  })

  it('force variable (*) : l’écart est ajouté au texte', () => {
    const stats = ptStats(catalog, onTable(5, { ptMod: { power: 2, toughness: 0 } }))
    expect(stats?.power).toEqual({ text: '*+2', delta: 2, value: null })
    expect(stats?.toughness).toEqual({ text: '1+*', delta: 0, value: null })
  })

  it('sans force connue : seulement l’écart, et rien sans écart', () => {
    expect(ptStats(catalog, onTable(2))).toBeNull()
    expect(ptStats(catalog, onTable(3, { ptMod: { power: 2, toughness: 1 } }))).toEqual({
      power: { text: '+2', delta: 2, value: null }, toughness: { text: '+1', delta: 1, value: null }, base: false,
    })
    expect(ptStats(catalog, onTable(2, { counters: { plus: 1, minus: 0, other: 0 } }))?.power.text).toBe('+1')
  })

  it('face cachée : 2/2 modifiable', () => {
    expect(ptStats(catalog, onTable(5, { faceDown: true, ptMod: { power: 1, toughness: 1 } }))?.power).toEqual({ text: '3', delta: 1, value: 3 })
  })
})

describe('journal', () => {
  it('valeur affichée et modification', () => {
    expect(signed(0)).toBe('+0')
    expect(signed(-2)).toBe('-2')
    expect(ptLog(catalog, onTable(1, { ptMod: { power: 3, toughness: 2 } }))).toBe('5/4 (+3/+2)')
    expect(ptLog(catalog, onTable(1))).toBe('2/2')
    expect(ptLog(catalog, onTable(2, { ptMod: { power: -1, toughness: 0 } }))).toBe('-1/+0')
    expect(ptLog(catalog, onTable(2))).toBe('force et endurance d’origine')
  })
})
