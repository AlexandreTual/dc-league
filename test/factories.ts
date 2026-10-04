import type { CardRow } from '@/lib/cards/types'

export function cardRow(overrides: Partial<CardRow> = {}): CardRow {
  return {
    id: 'sol-c21-en',
    oracle_id: 'oracle-sol',
    lang: 'en',
    name: 'Sol Ring',
    printed_name: null,
    set_code: 'c21',
    collector_number: '263',
    released_at: '2021-04-23',
    mana_cost: '{1}',
    cmc: 1,
    type_line: 'Artifact',
    printed_type_line: null,
    oracle_text: '{T}: Add {C}{C}.',
    printed_text: null,
    colors: [],
    color_identity: [],
    image_normal: 'https://cards.scryfall.io/normal/sol.jpg',
    image_small: 'https://cards.scryfall.io/small/sol.jpg',
    faces: null,
    ...overrides,
  }
}

/** Remplit le cache : pour chaque clé, une carte EN et éventuellement une carte FR. */
export async function seedCache(
  db: D1Database,
  entries: { key: string; en: CardRow | null; fr?: CardRow | null }[],
) {
  const { upsertCards, saveLookups } = await import('@/lib/db-cards')
  const now = new Date('2026-10-04T12:00:00Z')
  const cards = entries.flatMap((e) => [e.en, e.fr ?? null]).filter((c): c is CardRow => c !== null)
  await upsertCards(db, cards, now)
  await saveLookups(db, entries.map((e) => ({ key: e.key, en_card_id: e.en?.id ?? null, fr_card_id: e.fr?.id ?? null })), now)
}
