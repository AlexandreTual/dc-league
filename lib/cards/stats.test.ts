import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, MIGRATIONS } from '@/test/d1'
import { cardRow, deckCardView } from '@/test/factories'
import { getCards, upsertCards } from '@/lib/db-cards'
import { createScryfallClient, type ScryfallCard } from './scryfall'
import { fillCardStats } from './stats'
import type { CardFace } from './types'

type Fake = { status?: number; body: unknown }

/** Client Scryfall factice : réponses dans l'ordre, requêtes enregistrées. */
function client(responses: Fake[]) {
  const calls: { url: string; body: unknown }[] = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    const next = responses.shift() ?? { body: { data: [] } }
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 })
  }) as typeof fetch
  return { c: createScryfallClient({ fetch: fetchFn, sleep: async () => {} }), calls }
}

const scry = (overrides: Partial<ScryfallCard>): ScryfallCard => ({ id: 'x', lang: 'en', name: 'X', set: 'tst', collector_number: '1', ...overrides })
const face = (name: string): CardFace => ({
  name, printed_name: null, mana_cost: null, type_line: 'Creature', printed_type_line: null,
  oracle_text: null, printed_text: null, image_normal: `${name}.jpg`, image_small: null,
})

const now = new Date('2026-10-08T12:00:00Z')
// Cartes enregistrées avant la migration 0012 : force et endurance jamais lues.
const bear = cardRow({ id: 'bear', name: 'Grizzly Bears', power: undefined, toughness: undefined })
const ring = cardRow({ id: 'ring', power: undefined, toughness: undefined })
const delver = cardRow({ id: 'delver', power: undefined, toughness: undefined, faces: [face('Delver'), face('Aberration')] })
const fresh = cardRow({ id: 'fresh', power: '4', toughness: '4' })

let db: D1Database
beforeEach(async () => {
  db = createTestDb()
  await upsertCards(db, [bear, ring, delver, fresh, cardRow({ id: 'bear-fr', lang: 'fr', power: undefined, toughness: undefined })], now)
})

const deck = () => [
  deckCardView(1, bear, { fr: cardRow({ id: 'bear-fr', lang: 'fr' }) }),
  deckCardView(2, ring),
  deckCardView(3, delver),
  deckCardView(4, fresh),
  deckCardView(5, null, { name: 'Inconnue' }),
]

const answers: Fake = {
  body: {
    data: [
      scry({ id: 'bear', power: '2', toughness: '2' }),
      scry({ id: 'ring' }),
      scry({ id: 'delver', card_faces: [{ name: 'Delver', power: '1', toughness: '1' }, { name: 'Aberration', power: '3', toughness: '2' }] }),
    ],
  },
}

describe('fillCardStats', () => {
  it('relit chez Scryfall les seules cartes jamais lues, en un appel, et les enregistre', async () => {
    const { c, calls } = client([answers])
    const cards = await fillCardStats(db, c, deck())
    expect(calls).toHaveLength(1)
    expect(calls[0].body).toEqual({ identifiers: [{ id: 'bear' }, { id: 'ring' }, { id: 'delver' }] })

    expect(cards.map((x) => [x.en?.power, x.en?.toughness])).toEqual([['2', '2'], [null, null], ['1', '1'], ['4', '4'], [undefined, undefined]])
    // Faces : force et endurance ajoutées, le reste (images…) gardé.
    expect(cards[2].en!.faces).toEqual([{ ...face('Delver'), power: '1', toughness: '1' }, { ...face('Aberration'), power: '3', toughness: '2' }])
    expect(cards[0].fr).toEqual(deck()[0].fr)

    const saved = (await getCards(db, ['bear', 'ring', 'delver'])).data!
    expect([saved.bear.power, saved.ring.power, saved.delver.faces?.[1].toughness]).toEqual(['2', null, '2'])
  })

  it('deck déjà à jour : aucun appel', async () => {
    const { c, calls } = client([])
    const cards = [deckCardView(4, fresh)]
    expect(await fillCardStats(db, c, cards)).toBe(cards)
    expect(calls).toHaveLength(0)
  })

  it('Scryfall indisponible : le deck tel quel, sans erreur', async () => {
    const { c } = client([{ status: 503, body: {} }])
    const cards = deck()
    expect(await fillCardStats(db, c, cards)).toBe(cards)
  })

  it('base pas encore migrée : force et endurance utilisées pour cette fois, sans erreur', async () => {
    const old = createTestDb(MIGRATIONS.filter((f) => f < '0012'))
    const { c } = client([answers])
    const cards = await fillCardStats(old, c, deck())
    expect(cards[0].en?.power).toBe('2')
  })
})
