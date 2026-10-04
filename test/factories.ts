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
