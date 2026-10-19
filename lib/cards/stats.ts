// Rattrapage de la force, de l'endurance, de la loyauté et des capacités des cartes enregistrées avant les migrations 0012, 0014 et 0018.
import { saveCardStats, type CardStats } from '@/lib/db-cards'
import { toCardRow, type ScryfallClient } from './scryfall'
import type { CardRow, DeckCardView } from './types'

/**
 * Cartes du deck (versions anglaises) dont la force et l'endurance, la loyauté ou les capacités n'ont jamais été lues : elles sont relues
 * chez Scryfall (un appel pour 75 cartes), enregistrées, et le deck est renvoyé complété. Une seule fois par
 * carte : les suivantes la trouvent en base. Scryfall indisponible : le deck tel quel (pas de force affichée) ;
 * base pas encore migrée : le deck complété, sans rien enregistrer.
 */
export async function fillCardStats(db: D1Database, client: ScryfallClient, cards: DeckCardView[]): Promise<DeckCardView[]> {
  const missing = [...new Set(cards.flatMap((c) => (c.en && (c.en.power === undefined || c.en.loyalty === undefined || c.en.keywords === undefined) ? [c.en.id] : [])))]
  if (missing.length === 0) return cards

  let stats: Map<string, CardStats>
  try {
    const { cards: found } = await client.fetchCollection(missing.map((id) => ({ id })))
    const stored = new Map(cards.flatMap((c) => (c.en ? [[c.en.id, c.en] as const] : [])))
    stats = new Map(found.flatMap((card) => {
      const row = stored.get(card.id)
      return row ? [[card.id, statsOf(row, toCardRow(card))] as const] : []
    }))
  } catch (e) {
    console.error('[force/endurance]', (e as Error).message)
    return cards
  }

  const saved = await saveCardStats(db, [...stats.values()])
  if (saved.error !== null) console.error('[force/endurance]', saved.error)
  return cards.map((c) => {
    const s = c.en && stats.get(c.en.id)
    return s ? { ...c, en: { ...c.en!, ...s } } : c
  })
}

/** Force, endurance, loyauté et capacités relues, ajoutées aux faces enregistrées (images et textes gardés). */
function statsOf(stored: CardRow, read: CardRow): CardStats {
  const faces = stored.faces?.map((f, i) => {
    const r = read.faces?.[i]
    return { ...f, power: r?.power ?? null, toughness: r?.toughness ?? null, loyalty: r?.loyalty ?? null, keywords: r?.keywords ?? [] }
  }) ?? null
  return { id: stored.id, power: read.power ?? null, toughness: read.toughness ?? null, loyalty: read.loyalty ?? null, keywords: read.keywords ?? [], faces }
}
