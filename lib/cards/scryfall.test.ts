import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cardRow } from '@/test/factories'
import {
  createScryfallClient,
  pickFrenchPrint,
  ScryfallUnavailableError,
  toCardRow,
  type ScryfallCard,
} from './scryfall'

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(__dirname, '../../test/fixtures/scryfall', name), 'utf8'))
}

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown }

/** fetch factice : renvoie les réponses dans l'ordre et enregistre les requêtes. */
function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const calls: Call[] = []
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    const next = responses.shift() ?? { body: { object: 'list', data: [], not_found: [] } }
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200 })
  }) as typeof fetch
  return { fn, calls }
}

function client(responses: { status?: number; body: unknown }[]) {
  const f = fakeFetch(responses)
  const sleeps: number[] = []
  const c = createScryfallClient({ fetch: f.fn, sleep: async (ms) => { sleeps.push(ms) } })
  return { c, calls: f.calls, sleeps }
}

describe('fetchCollection', () => {
  it('envoie POST /cards/collection avec les bons en-têtes', async () => {
    const { c, calls } = client([{ body: fixture('collection.json') }])
    const ids = [{ set: 'c21', collector_number: '263' }, { name: 'Kenrith, the Returned King' }, { set: 'xxx', collector_number: '1' }]
    const r = await c.fetchCollection(ids)
    expect(calls[0].url).toBe('https://api.scryfall.com/cards/collection')
    expect(calls[0].method).toBe('POST')
    expect(calls[0].headers['user-agent']).toBe('dc-league/1.0')
    expect(calls[0].headers.accept).toBe('application/json')
    expect(calls[0].body).toEqual({ identifiers: ids })
    expect(r.cards.map((x) => x.id)).toEqual(['sol-c21-en', 'kenrith-eld-en'])
    expect(r.notFound).toEqual([{ set: 'xxx', collector_number: '1' }])
  })

  it('découpe au-delà de 75 identifiants', async () => {
    const { c, calls } = client([])
    await c.fetchCollection(Array.from({ length: 80 }, (_, i) => ({ name: `Card ${i}` })))
    expect(calls).toHaveLength(2)
    expect((calls[0].body as { identifiers: unknown[] }).identifiers).toHaveLength(75)
    expect((calls[1].body as { identifiers: unknown[] }).identifiers).toHaveLength(5)
  })

  it('n’appelle pas Scryfall sans identifiant', async () => {
    const { c, calls } = client([])
    expect(await c.fetchCollection([])).toEqual({ cards: [], notFound: [] })
    expect(calls).toHaveLength(0)
  })
})

describe('searchFrenchPrints', () => {
  it('groupe par 10 et suit la pagination', async () => {
    const { c, calls } = client([
      { body: fixture('search-fr-page1.json') },
      { body: fixture('search-fr-page2.json') },
      { body: { object: 'list', has_more: false, data: [] } },
    ])
    const ids = Array.from({ length: 12 }, (_, i) => `o${i}`)
    const cards = await c.searchFrenchPrints(ids)
    expect(calls).toHaveLength(3)
    const first = new URL(calls[0].url)
    expect(first.pathname).toBe('/cards/search')
    expect(first.searchParams.get('q')).toBe(`(${ids.slice(0, 10).map((o) => `oracleid:${o}`).join(' or ')}) lang:fr`)
    expect(first.searchParams.get('unique')).toBe('prints')
    expect(first.searchParams.get('order')).toBe('released')
    expect(first.searchParams.get('dir')).toBe('desc')
    expect(first.searchParams.get('include_extras')).toBe('true')
    expect(calls[1].url).toBe('https://api.scryfall.com/cards/search?page=2&q=test')
    expect(new URL(calls[2].url).searchParams.get('q')).toBe('(oracleid:o10 or oracleid:o11) lang:fr')
    expect(cards.map((x) => x.id)).toEqual(['sol-c21-fr', 'sol-cmr-fr', 'kenrith-eld-fr'])
  })

  it('renvoie [] sur un 404', async () => {
    const { c } = client([{ status: 404, body: fixture('search-not-found.json') }])
    expect(await c.searchFrenchPrints(['o1'])).toEqual([])
  })
})

describe('erreurs et rythme', () => {
  it.each([429, 503])('%s → ScryfallUnavailableError', async (status) => {
    const { c } = client([{ status, body: { object: 'error' } }])
    await expect(c.fetchCollection([{ name: 'Sol Ring' }])).rejects.toBeInstanceOf(ScryfallUnavailableError)
  })

  it('403 → ScryfallUnavailableError', async () => {
    const { c } = client([{ status: 403, body: 'Host not in allowlist' }])
    await expect(c.fetchCollection([{ name: 'Sol Ring' }])).rejects.toBeInstanceOf(ScryfallUnavailableError)
  })

  it('réponse illisible → ScryfallUnavailableError', async () => {
    const f = (async () => new Response('Host not in allowlist', { status: 200 })) as typeof fetch
    const c = createScryfallClient({ fetch: f, sleep: async () => {} })
    await expect(c.fetchCollection([{ name: 'Sol Ring' }])).rejects.toBeInstanceOf(ScryfallUnavailableError)
  })

  it('erreur réseau → ScryfallUnavailableError', async () => {
    const f = (async () => { throw new TypeError('fetch failed') }) as typeof fetch
    const c = createScryfallClient({ fetch: f, sleep: async () => {} })
    await expect(c.searchFrenchPrints(['o1'])).rejects.toBeInstanceOf(ScryfallUnavailableError)
  })

  it('attend entre deux appels', async () => {
    const { c, sleeps } = client([])
    await c.fetchCollection([{ name: 'A' }])
    await c.fetchCollection([{ name: 'B' }])
    expect(sleeps).toHaveLength(1)
    expect(sleeps[0]).toBeGreaterThan(0)
    expect(sleeps[0]).toBeLessThanOrEqual(100)
  })
})

describe('toCardRow', () => {
  const collection = fixture('collection.json') as { data: ScryfallCard[] }

  it('convertit une carte simple', () => {
    expect(toCardRow(collection.data[0])).toEqual(
      cardRow({
        image_normal: 'https://cards.scryfall.io/normal/front/sol-c21-en.jpg',
        image_small: 'https://cards.scryfall.io/small/front/sol-c21-en.jpg',
      }),
    )
  })

  it('convertit une carte double face', () => {
    const row = toCardRow((fixture('collection-dfc.json') as { data: ScryfallCard[] }).data[0])
    expect(row.faces).toHaveLength(2)
    expect(row.image_normal).toBe('https://cards.scryfall.io/normal/front/delver-front.jpg')
    expect(row.image_normal).toBe(row.faces![0].image_normal)
    expect(row.faces![1].image_normal).toBe('https://cards.scryfall.io/normal/back/delver.jpg')
    expect(row.type_line).toBe('Creature — Human Wizard // Creature — Human Insect')
    expect(row.mana_cost).toBe('{U}')
    expect(row.colors).toEqual(['U'])
  })

  it('lit les champs imprimés d’une carte française', () => {
    const fr = (fixture('search-fr-page2.json') as { data: ScryfallCard[] }).data[0]
    expect(toCardRow(fr)).toMatchObject({
      lang: 'fr',
      printed_name: 'Kenrith, le roi revenu',
      printed_type_line: 'Créature légendaire : humain et noble',
      printed_text: "{R} : Les créatures acquièrent le piétinement et la célérité jusqu'à la fin du tour.",
    })
  })
})

describe('pickFrenchPrint', () => {
  const c21 = cardRow({ id: 'a', set_code: 'c21', collector_number: '263', lang: 'fr' })
  const c21other = cardRow({ id: 'b', set_code: 'c21', collector_number: '999', lang: 'fr' })
  const cmr = cardRow({ id: 'c', set_code: 'cmr', collector_number: '472', lang: 'fr' })

  it('préfère même édition et même numéro', () => {
    expect(pickFrenchPrint([cmr, c21other, c21], { set: 'C21', number: '263' })?.id).toBe('a')
  })
  it('sinon même édition', () => {
    expect(pickFrenchPrint([cmr, c21other], { set: 'c21', number: '263' })?.id).toBe('b')
  })
  it('sinon la plus récente (la première)', () => {
    expect(pickFrenchPrint([cmr, c21], { set: 'm21', number: '1' })?.id).toBe('c')
    expect(pickFrenchPrint([cmr, c21], { set: null, number: null })?.id).toBe('c')
  })
  it('null sans impression', () => {
    expect(pickFrenchPrint([], { set: null, number: null })).toBeNull()
  })
})
