import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { cardRow, seedCache } from '@/test/factories'
import { listDeckTokens, replaceDeckTokens } from '@/lib/db-cards'
import { createScryfallClient, type ScryfallCard } from './scryfall'
import { extractTokenParts, fetchDeckTokens, refreshDeckTokens } from './tokens'

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

function card(overrides: Partial<ScryfallCard>): ScryfallCard {
  return { id: 'x', lang: 'en', name: 'X', set: 'tst', collector_number: '1', ...overrides }
}

const avenger = card({
  id: 'avenger',
  name: 'Avenger of Zendikar',
  all_parts: [
    { id: 'avenger', component: 'combo_piece', name: 'Avenger of Zendikar', type_line: 'Creature — Elemental' },
    { id: 'plant-wwk', component: 'token', name: 'Plant', type_line: 'Token Creature — Plant' },
  ],
})
const khalni = card({
  id: 'khalni',
  name: 'Khalni Garden',
  all_parts: [
    { id: 'khalni', component: 'combo_piece', name: 'Khalni Garden', type_line: 'Land' },
    { id: 'plant-wwk', component: 'token', name: 'Plant', type_line: 'Token Creature — Plant' },
  ],
})
const sorin = card({
  id: 'sorin',
  name: 'Sorin, Vengeful Bloodlord',
  all_parts: [{ id: 'emblem', component: 'token', name: 'Sorin Emblem', type_line: 'Emblem — Sorin' }],
})
const solRing = card({ id: 'sol', name: 'Sol Ring' })

const plant = card({
  id: 'plant-wwk',
  oracle_id: 'oracle-plant',
  name: 'Plant',
  set: 'twwk',
  collector_number: '1',
  type_line: 'Token Creature — Plant',
  power: '0',
  toughness: '1',
  colors: ['G'],
  image_uris: { normal: 'https://cards.scryfall.io/normal/plant-en.jpg' },
})
const plantFr = card({
  ...plant,
  id: 'plant-wwk-fr',
  lang: 'fr',
  printed_name: 'Plante',
  image_uris: { normal: 'https://cards.scryfall.io/normal/plant-fr.jpg' },
})

describe('extractTokenParts', () => {
  it('dédoublonne les jetons, garde leurs cartes sources et ignore emblèmes et cartes sans jeton', () => {
    const parts = extractTokenParts([avenger, khalni, sorin, solRing], (c) => c.name)
    expect([...parts]).toEqual([['plant-wwk', ['Avenger of Zendikar', 'Khalni Garden']]])
  })

  it('ignore les pièces de combo et la carte elle-même', () => {
    const parts = extractTokenParts([card({ id: 'a', all_parts: [{ id: 'a', component: 'token', name: 'A' }, { id: 'b', component: 'combo_piece', name: 'B' }] })], (c) => c.name)
    expect(parts.size).toBe(0)
  })
})

describe('fetchDeckTokens', () => {
  it('choisit l’impression française quand elle existe (nom et image)', async () => {
    const { c, calls } = client([
      { body: { data: [avenger, khalni] } },
      { body: { data: [plant] } },
      { body: { data: [plantFr], has_more: false } },
    ])
    const tokens = await fetchDeckTokens(c, [{ id: 'avenger', name: 'Avenger of Zendikar' }, { id: 'khalni', name: 'Jardin de Khalni' }])
    expect(calls[0].body).toEqual({ identifiers: [{ id: 'avenger' }, { id: 'khalni' }] })
    expect(calls[1].body).toEqual({ identifiers: [{ id: 'plant-wwk' }] })
    expect(tokens).toEqual([
      {
        id: 'plant-wwk-fr',
        name: 'Plante',
        typeLine: 'Token Creature — Plant',
        power: '0',
        toughness: '1',
        colors: ['G'],
        image: 'https://cards.scryfall.io/normal/plant-fr.jpg',
        sources: ['Avenger of Zendikar', 'Jardin de Khalni'],
      },
    ])
  })

  it('reste en anglais sans impression française', async () => {
    const { c } = client([{ body: { data: [avenger] } }, { body: { data: [plant] } }, { status: 404, body: {} }])
    const tokens = await fetchDeckTokens(c, [{ id: 'avenger', name: 'Avenger of Zendikar' }])
    expect(tokens).toMatchObject([{ id: 'plant-wwk', name: 'Plant', image: 'https://cards.scryfall.io/normal/plant-en.jpg' }])
  })

  it('un deck sans jeton ne fait qu’un appel', async () => {
    const { c, calls } = client([{ body: { data: [solRing] } }])
    expect(await fetchDeckTokens(c, [{ id: 'sol', name: 'Sol Ring' }])).toEqual([])
    expect(calls).toHaveLength(1)
  })

  it('regroupe deux impressions du même jeton', async () => {
    const other = card({ id: 'maker', name: 'Maker', all_parts: [{ id: 'plant-2', component: 'token', name: 'Plant' }] })
    const { c } = client([
      { body: { data: [avenger, other] } },
      { body: { data: [plant, { ...plant, id: 'plant-2', set: 'tznr' }] } },
      { status: 404, body: {} },
    ])
    const tokens = await fetchDeckTokens(c, [{ id: 'avenger', name: 'Avenger of Zendikar' }, { id: 'maker', name: 'Maker' }])
    expect(tokens).toHaveLength(1)
    expect(tokens[0].sources).toEqual(['Avenger of Zendikar', 'Maker'])
  })
})

describe('refreshDeckTokens', () => {
  let db: D1Database

  beforeEach(async () => {
    db = createTestDb()
    await db.batch([
      db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex')"),
      db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d1', 'p1', 'Plantes')"),
    ])
    await seedCache(db, [
      { key: 'avenger', en: cardRow({ id: 'avenger', name: 'Avenger of Zendikar' }), fr: cardRow({ id: 'avenger-fr', lang: 'fr', name: 'Avenger of Zendikar', printed_name: 'Vengeur de Zendikar' }) },
    ])
    await db.batch([
      db.prepare("INSERT INTO deck_cards (deck_id, position, quantity, section, requested_name, en_card_id, fr_card_id) VALUES ('d1', 1, 1, 'main', 'Avenger of Zendikar', 'avenger', 'avenger-fr')"),
    ])
  })

  it('recalcule la liste depuis les cartes du deck et remplace l’ancienne', async () => {
    await replaceDeckTokens(db, 'd1', [{ id: 'old', name: 'Ancien', typeLine: 'Token', power: null, toughness: null, colors: [], image: null, sources: [] }])
    const { c } = client([{ body: { data: [avenger] } }, { body: { data: [plant] } }, { status: 404, body: {} }])
    const r = await refreshDeckTokens(db, c, 'd1')
    expect(r.error).toBeNull()
    const stored = (await listDeckTokens(db, 'd1')).data!
    expect(stored).toEqual([
      { name: 'Plant', typeLine: 'Token Creature — Plant', power: '0', toughness: '1', colors: ['G'], image: 'https://cards.scryfall.io/normal/plant-en.jpg', sources: ['Vengeur de Zendikar'] },
    ])
  })
})
