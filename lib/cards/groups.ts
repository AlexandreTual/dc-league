import type { CardRow, DeckCardView } from './types'

export type CardGroup =
  | 'commander' | 'creature' | 'planeswalker' | 'battle' | 'sorcery' | 'instant'
  | 'artifact' | 'enchantment' | 'land' | 'other' | 'notFound'

export type Lang = 'fr' | 'en'

export const GROUP_LABELS: Record<CardGroup, string> = {
  commander: 'Commandant',
  creature: 'Créatures',
  planeswalker: 'Planeswalkers',
  battle: 'Batailles',
  sorcery: 'Rituels',
  instant: 'Éphémères',
  artifact: 'Artefacts',
  enchantment: 'Enchantements',
  land: 'Terrains',
  other: 'Autres',
  notFound: 'Introuvables',
}

const GROUP_ORDER = Object.keys(GROUP_LABELS) as CardGroup[]

// Priorité des types, lue sur la face avant : un terrain-créature est un terrain, une créature-artefact une créature.
const TYPE_PRIORITY: [string, CardGroup][] = [
  ['Land', 'land'],
  ['Creature', 'creature'],
  ['Planeswalker', 'planeswalker'],
  ['Battle', 'battle'],
  ['Instant', 'instant'],
  ['Sorcery', 'sorcery'],
  ['Artifact', 'artifact'],
  ['Enchantment', 'enchantment'],
]

export function displayCard(card: DeckCardView, lang: Lang): CardRow | null {
  return (lang === 'fr' ? card.fr : null) ?? card.en
}

export function displayName(card: DeckCardView, lang: Lang): string {
  const shown = displayCard(card, lang)
  if (!shown) return card.requested_name
  return (lang === 'fr' ? shown.printed_name : null) ?? shown.name
}

function groupOf(card: DeckCardView): CardGroup {
  if (!card.en) return 'notFound'
  if (card.section === 'commander') return 'commander'
  const front = card.en.type_line.split(' // ')[0]
  return TYPE_PRIORITY.find(([type]) => front.includes(type))?.[1] ?? 'other'
}

export function groupDeckCards(cards: DeckCardView[], lang: Lang) {
  const byGroup = new Map<CardGroup, DeckCardView[]>()
  for (const card of cards) {
    const group = groupOf(card)
    byGroup.set(group, [...(byGroup.get(group) ?? []), card])
  }
  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => {
    const list = [...byGroup.get(group)!].sort(
      (a, b) => (a.en?.cmc ?? 0) - (b.en?.cmc ?? 0) || displayName(a, lang).localeCompare(displayName(b, lang), 'fr'),
    )
    return { group, label: GROUP_LABELS[group], count: list.reduce((n, c) => n + c.quantity, 0), cards: list }
  })
}
