import { describe, it, expect } from 'vitest'
import { cardRow } from '@/test/factories'
import type { CardRow, DeckCardView } from './types'
import { displayCard, displayName, groupDeckCards } from './groups'

let position = 0
function view(en: Partial<CardRow> | null, opts: { quantity?: number; section?: 'main' | 'commander'; fr?: Partial<CardRow> } = {}): DeckCardView {
  position++
  return {
    position,
    quantity: opts.quantity ?? 1,
    section: opts.section ?? 'main',
    requested_name: en?.name ?? 'Inconnue',
    en: en ? cardRow({ id: `c${position}`, ...en }) : null,
    fr: opts.fr ? cardRow({ id: `f${position}`, lang: 'fr', ...en, ...opts.fr }) : null,
  }
}

const groupOf = (cards: DeckCardView[]) => groupDeckCards(cards, 'en').map((g) => [g.group, g.cards.map((c) => c.en?.name ?? c.requested_name)])

describe('groupDeckCards', () => {
  it('classe selon la priorité des types', () => {
    const result = groupOf([
      view({ name: 'Dryad Arbor', type_line: 'Land Creature — Forest Dryad' }),
      view({ name: 'Solemn Simulacrum', type_line: 'Artifact Creature — Golem' }),
      view({ name: "Lovestruck Beast // Heart's Desire", type_line: 'Creature — Beast Noble // Sorcery — Adventure' }),
      view({ name: 'Sol Ring', type_line: 'Artifact' }),
    ])
    expect(result).toEqual([
      ['creature', ["Lovestruck Beast // Heart's Desire", 'Solemn Simulacrum']],
      ['artifact', ['Sol Ring']],
      ['land', ['Dryad Arbor']],
    ])
  })

  it('met la section commandant et les introuvables à part', () => {
    const result = groupOf([
      view({ name: 'Sol Ring', type_line: 'Artifact' }, { section: 'commander' }),
      view(null),
      view({ name: 'Counterspell', type_line: 'Instant' }),
    ])
    expect(result.map(([g]) => g)).toEqual(['commander', 'instant', 'notFound'])
  })

  it('suit l’ordre des groupes et compte les exemplaires', () => {
    const groups = groupDeckCards(
      [
        view({ name: 'Forest', type_line: 'Basic Land — Forest' }, { quantity: 30 }),
        view({ name: 'Wrath', type_line: 'Sorcery' }),
        view({ name: 'Bolt', type_line: 'Instant' }),
        view({ name: 'Rhystic Study', type_line: 'Enchantment' }),
        view({ name: 'Teferi', type_line: 'Legendary Planeswalker — Teferi' }),
        view({ name: 'Invasion', type_line: 'Battle — Siege' }),
        view({ name: 'Plane', type_line: 'Plane — Dominaria' }),
        view({ name: 'Llanowar Elves', type_line: 'Creature — Elf Druid' }),
        view({ name: 'Kenrith', type_line: 'Legendary Creature' }, { section: 'commander' }),
      ],
      'en',
    )
    expect(groups.map((g) => g.group)).toEqual([
      'commander', 'creature', 'planeswalker', 'battle', 'sorcery', 'instant', 'enchantment', 'land', 'other',
    ])
    expect(groups.find((g) => g.group === 'land')).toMatchObject({ label: 'Terrains', count: 30 })
    expect(groups[0].label).toBe('Commandant')
  })

  it('trie par coût puis par nom affiché', () => {
    const cards = [
      view({ name: 'Zebra', type_line: 'Creature', cmc: 2 }),
      view({ name: 'Apple', type_line: 'Creature', cmc: 3 }),
      view({ name: 'Mango', type_line: 'Creature', cmc: 2 }, { fr: { printed_name: 'Abricot' } }),
    ]
    expect(groupDeckCards(cards, 'en')[0].cards.map((c) => c.en!.name)).toEqual(['Mango', 'Zebra', 'Apple'])
    expect(groupDeckCards(cards, 'fr')[0].cards.map((c) => c.en!.name)).toEqual(['Mango', 'Zebra', 'Apple'])
    const frOrder = groupDeckCards([cards[0], cards[2]], 'fr')[0].cards.map((c) => displayCard(c, 'fr')!.printed_name ?? c.en!.name)
    expect(frOrder).toEqual(['Abricot', 'Zebra'])
  })
})

describe('displayCard', () => {
  it('prend la version française si demandée et disponible, sinon l’anglaise', () => {
    const withFr = view({ name: 'Sol Ring' }, { fr: { printed_name: 'Anneau solaire' } })
    const withoutFr = view({ name: 'Mystic Remora' })
    expect(displayCard(withFr, 'fr')?.lang).toBe('fr')
    expect(displayCard(withFr, 'en')?.lang).toBe('en')
    expect(displayCard(withoutFr, 'fr')?.lang).toBe('en')
    expect(displayCard(view(null), 'fr')).toBeNull()
  })
})

describe('displayName', () => {
  const face = (name: string, printed_name: string | null) => ({
    name, printed_name, mana_cost: null, type_line: 'Creature', printed_type_line: null,
    oracle_text: null, printed_text: null, image_normal: null, image_small: null,
  })

  it('carte recto-verso déjà en cache sans nom imprimé global : noms imprimés des faces', () => {
    const card = view(
      { name: 'Delver of Secrets // Insectile Aberration' },
      { fr: { printed_name: null, faces: [face('Delver of Secrets', 'Sondeur de secrets'), face('Insectile Aberration', 'Aberration insectile')] } },
    )
    expect(displayName(card, 'fr')).toBe('Sondeur de secrets // Aberration insectile')
    expect(displayName(card, 'en')).toBe('Delver of Secrets // Insectile Aberration')
  })

  it('sans nom imprimé ni faces : nom anglais', () => {
    expect(displayName(view({ name: 'Mystic Remora' }, { fr: { printed_name: null } }), 'fr')).toBe('Mystic Remora')
  })
})
