import type { Messages } from '@/lib/i18n/messages'
import type { CardRow, DeckCardView } from './types'

export type CardGroup =
  | 'commander' | 'creature' | 'planeswalker' | 'battle' | 'sorcery' | 'instant'
  | 'artifact' | 'enchantment' | 'land' | 'other' | 'notFound'

export type Lang = 'fr' | 'en'

/** Ordre des groupes sur la page d'un deck ; leurs titres sont dans le dictionnaire (`decks.groups`). */
const GROUP_ORDER: CardGroup[] = [
  'commander', 'creature', 'planeswalker', 'battle', 'sorcery', 'instant',
  'artifact', 'enchantment', 'land', 'other', 'notFound',
]

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
  return (lang === 'fr' ? frenchName(shown) : null) ?? shown.name
}

/** Nom imprimé ; pour une carte recto-verso mise en cache sans nom global, celui de ses faces. */
function frenchName(card: CardRow): string | null {
  if (card.printed_name) return card.printed_name
  if (!card.faces?.some((f) => f.printed_name)) return null
  return card.faces.map((f) => f.printed_name || f.name).join(' // ')
}

function groupOf(card: DeckCardView): CardGroup {
  if (!card.en) return 'notFound'
  if (card.section === 'commander') return 'commander'
  const front = card.en.type_line.split(' // ')[0]
  return TYPE_PRIORITY.find(([type]) => front.includes(type))?.[1] ?? 'other'
}

/** Cartes groupées par type ; `lang` : langue des cartes (tri par nom affiché), `t` : langue de l'interface (titres). */
export function groupDeckCards(cards: DeckCardView[], lang: Lang, t: Messages) {
  const byGroup = new Map<CardGroup, DeckCardView[]>()
  for (const card of cards) {
    const group = groupOf(card)
    byGroup.set(group, [...(byGroup.get(group) ?? []), card])
  }
  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((group) => {
    const list = [...byGroup.get(group)!].sort(
      (a, b) => (a.en?.cmc ?? 0) - (b.en?.cmc ?? 0) || displayName(a, lang).localeCompare(displayName(b, lang), 'fr'),
    )
    return { group, label: t.decks.groups[group], count: list.reduce((n, c) => n + c.quantity, 0), cards: list }
  })
}
