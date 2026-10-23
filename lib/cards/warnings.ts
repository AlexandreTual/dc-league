import type { CardRow, DeckCardView } from './types'

/** Ce que les avertissements lisent d'une ligne du deck. */
export type WarningCard = Pick<DeckCardView, 'quantity' | 'section'> & { en: CardRow | null }

/** Écart au format Commander, non bloquant (#239). */
export type DeckWarning<C extends WarningCard = WarningCard> =
  | { kind: 'total'; total: number }
  | { kind: 'duplicates'; cards: { card: C; quantity: number }[] }
  | { kind: 'identity'; commanders: number; cards: C[] }

export const COMMANDER_DECK_SIZE = 100

const UNLIMITED = 'a deck can have any number of cards named'

/** Terrain de base, ou carte « un deck peut contenir n'importe quel nombre de cartes appelées… ». */
function unlimited(card: CardRow): boolean {
  if (card.type_line.split(' // ')[0].includes('Basic')) return true
  const texts = [card.oracle_text, ...(card.faces ?? []).map((f) => f.oracle_text)]
  return texts.some((t) => t?.toLowerCase().includes(UNLIMITED))
}

/**
 * Avertissements du format Commander : total différent de 100, plusieurs exemplaires d'une carte hors terrains de base
 * et cartes « nombre illimité », cartes hors de l'identité couleur du ou des commandants. Les cartes introuvables
 * comptent dans le total mais pas dans les autres vérifications ; sans commandant trouvé, l'identité n'est pas vérifiée.
 */
export function deckWarnings<C extends WarningCard>(cards: C[]): DeckWarning<C>[] {
  const warnings: DeckWarning<C>[] = []
  if (cards.length === 0) return warnings

  const total = cards.reduce((n, c) => n + c.quantity, 0)
  if (total !== COMMANDER_DECK_SIZE) warnings.push({ kind: 'total', total })

  // Une même carte peut figurer sur plusieurs lignes (impressions différentes) : les quantités s'additionnent.
  const byName = new Map<string, { card: C; quantity: number }>()
  for (const c of cards) {
    if (!c.en || unlimited(c.en)) continue
    const entry = byName.get(c.en.name)
    if (entry) entry.quantity += c.quantity
    else byName.set(c.en.name, { card: c, quantity: c.quantity })
  }
  const duplicates = [...byName.values()].filter((d) => d.quantity > 1)
  if (duplicates.length) warnings.push({ kind: 'duplicates', cards: duplicates })

  const commanders = cards.filter((c) => c.section === 'commander' && c.en)
  if (commanders.length) {
    const identity = new Set(commanders.flatMap((c) => c.en!.color_identity))
    const outside = cards.filter((c) => c.section !== 'commander' && c.en && c.en.color_identity.some((color) => !identity.has(color)))
    if (outside.length) warnings.push({ kind: 'identity', commanders: commanders.length, cards: outside })
  }
  return warnings
}

/** Texte d'un avertissement, avec le nom de chaque carte donné par `nameOf` (langue choisie). */
export function warningText<C extends WarningCard>(warning: DeckWarning<C>, nameOf: (card: C) => string): string {
  switch (warning.kind) {
    case 'total':
      return `Le deck compte ${warning.total} carte${warning.total > 1 ? 's' : ''} au lieu de ${COMMANDER_DECK_SIZE}.`
    case 'duplicates':
      return `Plusieurs exemplaires d'une carte hors terrains de base : ${warning.cards.map((d) => `${nameOf(d.card)} (×${d.quantity})`).join(', ')}.`
    case 'identity':
      return `Hors de l'identité couleur ${warning.commanders > 1 ? 'des commandants' : 'du commandant'} : ${warning.cards.map(nameOf).join(', ')}.`
  }
}
