// Types de cartes (Créature, Terrain…) pour filtrer une pile, d'après la ligne de type anglaise de la face visible.
import { cardInfo, type CardInfo } from './apply'
import type { Catalog, VisibleCard } from './types'

export type CardType = 'creature' | 'land' | 'artifact' | 'enchantment' | 'instant' | 'sorcery' | 'planeswalker' | 'battle'

/** Dans l'ordre des boutons de filtre. */
export const CARD_TYPES: { type: CardType; label: string; word: string }[] = [
  { type: 'creature', label: 'Créature', word: 'Creature' },
  { type: 'land', label: 'Terrain', word: 'Land' },
  { type: 'artifact', label: 'Artefact', word: 'Artifact' },
  { type: 'enchantment', label: 'Enchantement', word: 'Enchantment' },
  { type: 'instant', label: 'Éphémère', word: 'Instant' },
  { type: 'sorcery', label: 'Rituel', word: 'Sorcery' },
  { type: 'planeswalker', label: 'Planeswalker', word: 'Planeswalker' },
  { type: 'battle', label: 'Bataille', word: 'Battle' },
]

/** Tous les types d'une ligne de type anglaise ; pour une carte double face, seulement la première face. */
export function cardTypes(info: Pick<CardInfo, 'typeLine'>): CardType[] {
  const words = info.typeLine.split(' // ')[0].split('—')[0].split(/\s+/)
  return CARD_TYPES.filter((t) => words.includes(t.word)).map((t) => t.type)
}

const typesOf = (card: VisibleCard, catalogs: Record<string, Catalog>) => cardTypes(cardInfo(catalogs[card.owner], card, 'en'))

/** Nombre de cartes par type présent dans la pile (une carte compte pour chacun de ses types). */
export function countByType(cards: VisibleCard[], catalogs: Record<string, Catalog>): { type: CardType; label: string; count: number }[] {
  const counts = new Map<CardType, number>()
  for (const card of cards) for (const t of typesOf(card, catalogs)) counts.set(t, (counts.get(t) ?? 0) + 1)
  return CARD_TYPES.filter((t) => counts.has(t.type)).map((t) => ({ type: t.type, label: t.label, count: counts.get(t.type)! }))
}

/** Filtres d'une pile : le texte (nom FR ou EN) **et** au moins un des types cochés (aucun type coché = tous). */
export function filterPile(cards: VisibleCard[], filter: { text: string; types: CardType[] }, catalogs: Record<string, Catalog>): VisibleCard[] {
  const q = filter.text.trim().toLowerCase()
  return cards.filter((card) => {
    if (q) {
      const names = [cardInfo(catalogs[card.owner], card, 'fr').name, cardInfo(catalogs[card.owner], card, 'en').name]
      if (!names.some((n) => n.toLowerCase().includes(q))) return false
    }
    return filter.types.length === 0 || typesOf(card, catalogs).some((t) => filter.types.includes(t))
  })
}
