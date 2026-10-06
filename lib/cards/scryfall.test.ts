import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cardRow } from '@/test/factories'
import {
  createScryfallClient,
  pickFrenchPrint,
  ScryfallUnavailableError,
  toCardRow,
  toFrenchPrint,
  type ScryfallCard,
} from './scryfall'

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(__dirname, '../../test/fixtures/scryfall', name), 'utf8'))
}

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown }

/** fetch factice : renvoie les réponses dans l'ordre et enregistre les requêtes. */
type FakeResponse = { status?: number; body: unknown; headers?: Record<string, string> }

function fakeFetch(responses: FakeResponse[]) {
  const calls: Call[] = []
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    const next: FakeResponse = responses.shift() ?? { body: { object: 'list', data: [], not_found: [] } }
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: next.headers })
  }) as typeof fetch
  return { fn, calls }
}

function client(responses: FakeResponse[]) {
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
  it('groupe par 20 et ne lit qu’une page', async () => {
    const { c, calls } = client([
      { body: { ...(fixture('search-fr-page1.json') as object), has_more: false } },
      { body: fixture('search-fr-page2.json') },
    ])
    const ids = Array.from({ length: 22 }, (_, i) => `o${i}`)
    const cards = await c.searchFrenchPrints(ids)
    expect(calls).toHaveLength(2)
    const first = new URL(calls[0].url)
    expect(first.pathname).toBe('/cards/search')
    expect(first.searchParams.get('q')).toBe(`(${ids.slice(0, 20).map((o) => `oracleid:${o}`).join(' or ')}) lang:fr`)
    expect(first.searchParams.get('unique')).toBe('prints')
    expect(first.searchParams.get('order')).toBe('released')
    expect(first.searchParams.get('dir')).toBe('desc')
    expect(first.searchParams.get('include_extras')).toBe('true')
    expect(new URL(calls[1].url).searchParams.get('q')).toBe('(oracleid:o20 or oracleid:o21) lang:fr')
    expect(cards.map((x) => x.id)).toEqual(['sol-c21-fr', 'sol-cmr-fr', 'kenrith-eld-fr'])
  })

  it('la requête reste sous les 1000 caractères acceptés par Scryfall', async () => {
    const { c, calls } = client([])
    await c.searchFrenchPrints(Array.from({ length: 20 }, () => crypto.randomUUID()))
    expect(calls).toHaveLength(1)
    expect(new URL(calls[0].url).searchParams.get('q')!.length).toBeLessThanOrEqual(1000)
  })

  it('page pleine : relance seulement les cartes absentes de la page, jamais la page suivante', async () => {
    const forest = (i: number) => ({ id: `forest-${i}`, oracle_id: 'o-forest', lang: 'fr', name: 'Forest', set: 's', collector_number: `${i}` })
    const { c, calls } = client([
      { body: { object: 'list', has_more: true, next_page: 'https://api.scryfall.com/cards/search?page=2', data: [forest(1), forest(2)] } },
      { body: { object: 'list', has_more: false, data: [{ id: 'sol-fr', oracle_id: 'o-sol', lang: 'fr', name: 'Sol Ring', set: 'c21', collector_number: '263' }] } },
    ])
    const cards = await c.searchFrenchPrints(['o-forest', 'o-sol', 'o-none'])
    expect(calls).toHaveLength(2)
    expect(new URL(calls[1].url).searchParams.get('q')).toBe('(oracleid:o-sol or oracleid:o-none) lang:fr')
    expect(cards.map((x) => x.id)).toEqual(['forest-1', 'forest-2', 'sol-fr'])
  })

  it('renvoie [] sur un 404', async () => {
    const { c } = client([{ status: 404, body: fixture('search-not-found.json') }])
    expect(await c.searchFrenchPrints(['o1'])).toEqual([])
  })
})

describe('erreurs et rythme', () => {
  it('429 : attend Retry-After puis réessaie une fois', async () => {
    const { c, calls, sleeps } = client([
      { status: 429, body: { object: 'error' }, headers: { 'Retry-After': '12' } },
      { body: fixture('collection.json') },
    ])
    const r = await c.fetchCollection([{ name: 'Sol Ring' }])
    expect(calls).toHaveLength(2)
    expect(sleeps).toContain(12000)
    expect(r.cards).toHaveLength(2)
  })

  it('429 sans Retry-After : attend 30 s', async () => {
    const { c, sleeps } = client([{ status: 429, body: { object: 'error' } }, { body: fixture('collection.json') }])
    await c.fetchCollection([{ name: 'Sol Ring' }])
    expect(sleeps).toContain(30000)
  })

  it('deux 429 de suite → ScryfallUnavailableError', async () => {
    const { c, calls } = client([
      { status: 429, body: { object: 'error' } },
      { status: 429, body: { object: 'error' } },
    ])
    await expect(c.fetchCollection([{ name: 'Sol Ring' }])).rejects.toBeInstanceOf(ScryfallUnavailableError)
    expect(calls).toHaveLength(2)
  })

  it('503 → ScryfallUnavailableError', async () => {
    const { c } = client([{ status: 503, body: { object: 'error' } }])
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

  it('délai d’attente : chaque appel porte un signal d’annulation de 10 s', async () => {
    let signal: AbortSignal | null | undefined
    const f = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal
      return new Response(JSON.stringify({ data: [] }))
    }) as typeof fetch
    const timeouts: number[] = []
    const c = createScryfallClient({ fetch: f, sleep: async () => {}, timeout: (ms) => { timeouts.push(ms); return AbortSignal.timeout(ms) } })
    await c.fetchCollection([{ name: 'Sol Ring' }])
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(timeouts).toEqual([10000])
  })

  it('délai dépassé → ScryfallUnavailableError', async () => {
    const f = (async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError') }) as typeof fetch
    const c = createScryfallClient({ fetch: f, sleep: async () => {} })
    await expect(c.fetchCollection([{ name: 'Sol Ring' }])).rejects.toBeInstanceOf(ScryfallUnavailableError)
  })

  it('attend 500 ms entre deux appels, y compris avant le premier', async () => {
    const { c, sleeps } = client([])
    await c.fetchCollection([{ name: 'A' }])
    await c.fetchCollection([{ name: 'B' }])
    expect(sleeps).toHaveLength(2)
    for (const ms of sleeps) {
      expect(ms).toBeGreaterThan(400)
      expect(ms).toBeLessThanOrEqual(500)
    }
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
    expect(row.printed_name).toBeNull()
  })

  it('nom français d’une carte recto-verso : noms imprimés des faces', () => {
    const card = (fixture('collection-dfc.json') as { data: ScryfallCard[] }).data[0]
    const fr: ScryfallCard = {
      ...card,
      lang: 'fr',
      card_faces: card.card_faces!.map((f, i) => ({ ...f, printed_name: ['Sondeur de secrets', 'Aberration insectile'][i] })),
    }
    expect(toCardRow(fr).printed_name).toBe('Sondeur de secrets // Aberration insectile')
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

  it('image provisoire (« Localized Image Not Available ») ou absente : aucune image retenue', () => {
    const card = collection.data[0]
    for (const image_status of ['placeholder', 'missing']) {
      const row = toCardRow({ ...card, lang: 'fr', image_status })
      expect(row.image_normal).toBeNull()
      expect(row.image_small).toBeNull()
    }
    const dfc = (fixture('collection-dfc.json') as { data: ScryfallCard[] }).data[0]
    const row = toCardRow({ ...dfc, lang: 'fr', image_status: 'placeholder' })
    expect(row.faces!.map((f) => f.image_normal)).toEqual([null, null])
    expect(row.image_normal).toBeNull()
  })

  it('vraie image (basse ou haute définition) : conservée', () => {
    const card = collection.data[0]
    expect(toCardRow({ ...card, image_status: 'lowres' }).image_normal).toBe('https://cards.scryfall.io/normal/front/sol-c21-en.jpg')
    expect(toCardRow({ ...card, image_status: 'highres_scan' }).image_normal).toBe('https://cards.scryfall.io/normal/front/sol-c21-en.jpg')
  })

  it('toFrenchPrint : marque les scans en haute définition', () => {
    const card = collection.data[0]
    expect(toFrenchPrint({ ...card, image_status: 'highres_scan' }).highres).toBe(true)
    expect(toFrenchPrint({ ...card, image_status: 'lowres' }).highres).toBe(false)
    expect(toFrenchPrint(card).highres).toBe(false)
  })

  it('toFrenchPrint : classique sauf foil seul, sans bordure, showcase, illustration étendue, gravée, promo', () => {
    const card = collection.data[0]
    expect(toFrenchPrint({ ...card, finishes: ['nonfoil', 'foil'], border_color: 'black' }).classic).toBe(true)
    expect(toFrenchPrint(card).classic).toBe(true)
    expect(toFrenchPrint({ ...card, finishes: ['foil'] }).classic).toBe(false)
    expect(toFrenchPrint({ ...card, finishes: ['etched'] }).classic).toBe(false)
    expect(toFrenchPrint({ ...card, border_color: 'borderless' }).classic).toBe(false)
    expect(toFrenchPrint({ ...card, frame_effects: ['showcase'] }).classic).toBe(false)
    expect(toFrenchPrint({ ...card, frame_effects: ['extendedart'] }).classic).toBe(false)
    expect(toFrenchPrint({ ...card, frame_effects: ['legendary'] }).classic).toBe(true)
    expect(toFrenchPrint({ ...card, full_art: true }).classic).toBe(false)
    expect(toFrenchPrint({ ...card, promo: true }).classic).toBe(false)
  })
})

describe('pickFrenchPrint', () => {
  // Impressions triées de la plus récente à la plus ancienne, comme la recherche Scryfall.
  const print = (id: string, set: string, cn: string, opts: { highres?: boolean; image?: boolean; classic?: boolean } = {}) => ({
    ...cardRow({ id, set_code: set, collector_number: cn, lang: 'fr', image_normal: opts.image === false ? null : `https://img/${id}.jpg` }),
    highres: opts.highres ?? false,
    classic: opts.classic ?? true,
  })
  const c21 = print('a', 'c21', '263')
  const c21other = print('b', 'c21', '999')
  const cmr = print('c', 'cmr', '472')

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

  it('image nette : la plus récente en haute définition plutôt que l’édition demandée en basse définition', () => {
    const recent = print('r', 'fin', '309', { highres: true })
    const old = print('o', 'tsr', '410')
    expect(pickFrenchPrint([recent, old], { set: 'tsr', number: '410' })?.id).toBe('r')
  })
  it('édition demandée en haute définition : gardée', () => {
    const recent = print('r', 'fin', '309', { highres: true })
    const asked = print('o', 'tsr', '410', { highres: true })
    expect(pickFrenchPrint([recent, asked], { set: 'tsr', number: '410' })?.id).toBe('o')
  })
  it('sans haute définition : écarte les impressions sans vraie image', () => {
    const recent = print('r', 'eoc', '191')
    const placeholder = print('p', 'tsp', '269', { image: false })
    expect(pickFrenchPrint([recent, placeholder], { set: 'tsp', number: '269' })?.id).toBe('r')
  })
  it('jamais une version foil ou spéciale choisie à la place de celle demandée', () => {
    const foil = print('f', 'fin', '500', { highres: true, classic: false })
    const recent = print('r', 'eoc', '191', { highres: true })
    const asked = print('o', 'tsr', '410')
    expect(pickFrenchPrint([foil, recent, asked], { set: 'tsr', number: '410' })?.id).toBe('r')
    expect(pickFrenchPrint([foil, asked], { set: 'tsr', number: '410' })?.id).toBe('o')
    expect(pickFrenchPrint([foil], { set: null, number: null })?.image_normal ?? null).toBeNull()
  })
  it('version spéciale demandée explicitement : gardée', () => {
    const asked = print('f', 'fin', '500', { highres: true, classic: false })
    const recent = print('r', 'eoc', '191', { highres: true })
    expect(pickFrenchPrint([recent, asked], { set: 'fin', number: '500' })?.id).toBe('f')
  })
  it('aucune vraie image : l’impression demandée quand même (texte français, image anglaise ajoutée plus tard)', () => {
    const other = print('x', '9ed', '317', { image: false })
    const asked = print('p', 'tsp', '269', { image: false })
    expect(pickFrenchPrint([other, asked], { set: 'tsp', number: '269' })?.id).toBe('p')
  })
})

describe('fetchRulings', () => {
  it('GET /cards/:id/rulings, date, source et texte', async () => {
    const { c, calls } = client([{ body: { object: 'list', data: [
      { object: 'ruling', oracle_id: 'o1', source: 'wotc', published_at: '2019-10-04', comment: 'Kenrith’s last ability…' },
      { object: 'ruling', oracle_id: 'o1', source: 'scryfall', published_at: '2020-01-01', comment: 'Note.' },
    ] } }])
    expect(await c.fetchRulings('kenrith-eld-en')).toEqual([
      { date: '2019-10-04', source: 'wotc', text: 'Kenrith’s last ability…' },
      { date: '2020-01-01', source: 'scryfall', text: 'Note.' },
    ])
    expect(calls[0].url).toBe('https://api.scryfall.com/cards/kenrith-eld-en/rulings')
    expect(calls[0].method).toBe('GET')
  })

  it('404 → aucune règle', async () => {
    const { c } = client([{ status: 404, body: { object: 'error' } }])
    expect(await c.fetchRulings('inconnue')).toEqual([])
  })

  it('503 → ScryfallUnavailableError', async () => {
    const { c } = client([{ status: 503, body: { object: 'error' } }])
    await expect(c.fetchRulings('x')).rejects.toBeInstanceOf(ScryfallUnavailableError)
  })
})
