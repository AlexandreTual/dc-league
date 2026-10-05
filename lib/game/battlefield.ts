// Rangées triées du champ de bataille d'un adversaire, pour les bandeaux compacts de la table.
import { cardInfo } from './apply'
import type { CardView, Catalog, VisibleCard } from './types'

export type Stack = { key: string; cards: VisibleCard[]; count: number }
export type BattlefieldRows = { creatures: Stack[]; others: Stack[]; lands: Stack[]; hidden: number }

/** Cartes identiques dans le même état : même propriétaire, même carte (ou jeton), même engagement, face, marqueurs. */
function stackKey(card: VisibleCard): string {
  const what = card.ref !== null ? `r${card.ref}` : `t:${card.token?.name ?? ''}`
  const { plus, minus, other } = card.counters
  return [card.owner, what, card.tapped, card.flipped, card.faceDown, plus, minus, other].join('|')
}

function rowOf(card: VisibleCard, catalogs: Record<string, Catalog>): 'creatures' | 'others' | 'lands' {
  if (card.faceDown) return 'others'
  const typeLine = cardInfo(catalogs[card.owner], card, 'en').typeLine
  if (typeLine.includes('Creature')) return 'creatures'
  if (typeLine.includes('Land')) return 'lands'
  return 'others'
}

/** Créatures / autres permanents / terrains, cartes identiques empilées, dans l'ordre d'arrivée. */
export function groupBattlefield(cards: CardView[], catalogs: Record<string, Catalog>): BattlefieldRows {
  const rows: BattlefieldRows = { creatures: [], others: [], lands: [], hidden: 0 }
  const byKey = new Map<string, Stack>()
  for (const card of cards) {
    if (card.hidden) {
      rows.hidden++
      continue
    }
    const key = stackKey(card)
    const existing = byKey.get(key)
    if (existing) {
      existing.cards.push(card)
      existing.count++
      continue
    }
    const stack: Stack = { key, cards: [card], count: 1 }
    byKey.set(key, stack)
    rows[rowOf(card, catalogs)].push(stack)
  }
  return rows
}
