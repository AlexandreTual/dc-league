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
    image_large: 'https://cards.scryfall.io/large/sol.jpg',
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

export function deckCardView(
  position: number,
  en: CardRow | null,
  opts: { quantity?: number; section?: 'main' | 'commander'; fr?: CardRow | null; name?: string } = {},
): import('@/lib/cards/types').DeckCardView {
  return {
    position,
    quantity: opts.quantity ?? 1,
    section: opts.section ?? 'main',
    requested_name: opts.name ?? en?.name ?? 'Inconnue',
    en,
    fr: opts.fr ?? null,
  }
}

const face = (name: string, type: string, image: string, power: string, toughness: string) => ({
  name, printed_name: null, mana_cost: null, type_line: type, printed_type_line: null,
  oracle_text: null, printed_text: null, image_normal: image, image_small: image, power, toughness,
})

/** Deck de test : Kenrith (commandant, 5/5), Sol Ring (avec version FR), 30 Forêts, Delver (double face, 1/1 puis 3/2) = 33 exemplaires. */
export function testDeckCards() {
  return [
    deckCardView(1, cardRow({ id: 'ken', name: 'Kenrith, the Returned King', type_line: 'Legendary Creature — Human Noble', power: '5', toughness: '5' }), { section: 'commander' }),
    deckCardView(2, cardRow({ id: 'sol' }), { fr: cardRow({ id: 'sol-fr', lang: 'fr', printed_name: 'Anneau solaire' }) }),
    deckCardView(3, cardRow({ id: 'forest', name: 'Forest', type_line: 'Basic Land — Forest', cmc: 0 }), { quantity: 30 }),
    deckCardView(4, cardRow({
      id: 'delver', name: 'Delver of Secrets // Insectile Aberration',
      type_line: 'Creature — Human Wizard // Creature — Human Insect',
      image_normal: 'front.jpg', power: '1', toughness: '1',
      faces: [face('Delver of Secrets', 'Creature — Human Wizard', 'front.jpg', '1', '1'), face('Insectile Aberration', 'Creature — Human Insect', 'back.jpg', '3', '2')],
    })),
  ]
}
