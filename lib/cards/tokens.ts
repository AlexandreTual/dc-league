import type { Result } from '@/lib/db'
import { listDeckCards, replaceDeckTokens } from '@/lib/db-cards'
import { pickFrenchPrint, toCardRow, type ScryfallCard, type ScryfallClient } from './scryfall'
import type { CardRow, DeckTokenRow } from './types'

/** Carte du deck dont on cherche les jetons : identifiant Scryfall anglais et nom affiché. */
export type TokenSource = { id: string; name: string }

const isEmblem = (typeLine: string | undefined) => (typeLine ?? '').includes('Emblem')

/**
 * Jetons créés par les cartes (`all_parts`, composant « token »), dédoublonnés par identifiant, avec les noms
 * des cartes qui les créent. Emblèmes, pièces de combo et la carte elle-même sont ignorés.
 */
export function extractTokenParts(cards: ScryfallCard[], nameOf: (card: ScryfallCard) => string): Map<string, string[]> {
  const parts = new Map<string, string[]>()
  for (const card of cards) {
    for (const part of card.all_parts ?? []) {
      if (part.component !== 'token' || part.id === card.id || isEmblem(part.type_line)) continue
      const sources = parts.get(part.id) ?? []
      const name = nameOf(card)
      if (!sources.includes(name)) sources.push(name)
      parts.set(part.id, sources)
    }
  }
  return parts
}

/** Jetons des cartes données, en français quand Scryfall en a une impression (nom et image), triés par nom. */
export async function fetchDeckTokens(client: ScryfallClient, sources: TokenSource[]): Promise<DeckTokenRow[]> {
  const names = new Map(sources.map((s) => [s.id, s.name]))
  const { cards } = await client.fetchCollection(sources.map((s) => ({ id: s.id })))
  const parts = extractTokenParts(cards, (c) => names.get(c.id) ?? c.name)
  if (parts.size === 0) return []

  // Plusieurs impressions d'un même jeton (Trésor de deux éditions…) n'en font qu'un.
  const { cards: tokenCards } = await client.fetchCollection([...parts.keys()].map((id) => ({ id })))
  const byOracle = new Map<string, { card: ScryfallCard; row: CardRow; sources: string[] }>()
  for (const card of tokenCards) {
    if (isEmblem(card.type_line)) continue
    const row = toCardRow(card)
    const group = byOracle.get(row.oracle_id) ?? { card, row, sources: [] }
    for (const name of parts.get(card.id) ?? []) if (!group.sources.includes(name)) group.sources.push(name)
    byOracle.set(row.oracle_id, group)
  }
  if (byOracle.size === 0) return []

  const frenchByOracle = new Map<string, CardRow[]>()
  for (const card of await client.searchFrenchPrints([...byOracle.keys()])) {
    const row = toCardRow(card)
    frenchByOracle.set(row.oracle_id, [...(frenchByOracle.get(row.oracle_id) ?? []), row])
  }

  return [...byOracle.values()]
    .map(({ card, row, sources: from }) => {
      const fr = pickFrenchPrint(frenchByOracle.get(row.oracle_id) ?? [], { set: row.set_code, number: row.collector_number })
      return {
        id: fr?.id ?? row.id,
        name: fr?.printed_name ?? row.name,
        typeLine: row.type_line || 'Token',
        power: card.power ?? card.card_faces?.[0]?.power ?? null,
        toughness: card.toughness ?? card.card_faces?.[0]?.toughness ?? null,
        colors: row.colors,
        image: fr?.image_normal ?? row.image_normal ?? row.image_small,
        sources: from,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/**
 * Recalcule et enregistre les jetons d'un deck à partir des cartes déjà importées.
 * Une indisponibilité de Scryfall est levée (ScryfallUnavailableError) sans toucher à la liste enregistrée.
 */
export async function refreshDeckTokens(db: D1Database, client: ScryfallClient, deckId: string): Promise<Result<DeckTokenRow[]>> {
  const cards = await listDeckCards(db, deckId)
  if (cards.error !== null) return { data: null, error: cards.error }
  const sources = new Map<string, string>()
  for (const c of cards.data) if (c.en && !sources.has(c.en.id)) sources.set(c.en.id, c.fr?.printed_name ?? c.en.name)

  const tokens = await fetchDeckTokens(client, [...sources].map(([id, name]) => ({ id, name })))
  const saved = await replaceDeckTokens(db, deckId, tokens)
  if (saved.error !== null) return { data: null, error: saved.error }
  return { data: tokens, error: null }
}
