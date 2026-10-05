import { describe, it, expect, vi } from 'vitest'
import { archidektToText, fetchDeckLink, moxfieldToText, parseDeckLink } from './deck-link'
import { parseDeckList } from './parse'

describe('parseDeckLink', () => {
  it.each([
    ['https://www.moxfield.com/decks/AbC-12_xyz', { site: 'moxfield', id: 'AbC-12_xyz' }],
    ['https://moxfield.com/decks/AbC-12_xyz/primer', { site: 'moxfield', id: 'AbC-12_xyz' }],
    ['moxfield.com/decks/AbC12?foo=1', { site: 'moxfield', id: 'AbC12' }],
    ['https://archidekt.com/decks/123456/kenrith_go_wide', { site: 'archidekt', id: '123456' }],
    ['https://www.archidekt.com/decks/42', { site: 'archidekt', id: '42' }],
    ['  https://archidekt.com/decks/42#top  ', { site: 'archidekt', id: '42' }],
  ])('reconnaît %s', (url, expected) => {
    expect(parseDeckLink(url)).toEqual(expected)
  })

  it.each([
    'https://example.com/decks/abc',
    'https://moxfield.com/users/alex',
    'https://archidekt.com/decks/abc',
    'https://moxfield.com.evil.example/decks/abc',
    'pas un lien',
    '',
  ])('refuse %s', (url) => {
    expect(parseDeckLink(url)).toBeNull()
  })
})

const moxCard = (name: string, set: string, cn: string, quantity = 1) => ({ quantity, card: { name, set, cn } })

const MOXFIELD = {
  name: 'Kenrith go wide',
  boards: {
    commanders: { count: 1, cards: { a: moxCard('Kenrith, the Returned King', 'eld', '303') } },
    mainboard: {
      count: 32,
      cards: {
        b: moxCard('Sol Ring', 'c21', '263'),
        c: moxCard('Forest', 'eld', '266', 30),
        d: moxCard('Delver of Secrets // Insectile Aberration', 'isd', '51'),
      },
    },
    sideboard: { count: 1, cards: { e: moxCard('Swords to Plowshares', 'sta', '10') } },
    maybeboard: { count: 1, cards: { f: moxCard('Counterspell', 'mh2', '267') } },
  },
}

describe('moxfieldToText', () => {
  it('garde commandant et deck principal, au format de l’import texte', () => {
    expect(moxfieldToText(MOXFIELD)).toBe(
      [
        'Commander',
        '1 Kenrith, the Returned King (eld) 303',
        '',
        'Deck',
        '1 Sol Ring (c21) 263',
        '30 Forest (eld) 266',
        '1 Delver of Secrets // Insectile Aberration (isd) 51',
      ].join('\n'),
    )
  })

  it('produit un texte lu sans erreur par l’import', () => {
    const parsed = parseDeckList(moxfieldToText(MOXFIELD)!)
    expect(parsed.errors).toEqual([])
    expect(parsed.lines.filter((l) => l.section === 'commander').map((l) => l.name)).toEqual(['Kenrith, the Returned King'])
    expect(parsed.lines.reduce((n, l) => n + l.quantity, 0)).toBe(33)
  })

  it('carte sans édition : nom seul', () => {
    const text = moxfieldToText({ boards: { mainboard: { cards: { a: { quantity: 2, card: { name: 'Sol Ring' } } } } } })
    expect(text).toBe('Deck\n2 Sol Ring')
  })

  it('réponse inattendue → null', () => {
    expect(moxfieldToText({})).toBeNull()
    expect(moxfieldToText(null)).toBeNull()
    expect(moxfieldToText({ boards: { mainboard: { cards: {} } } })).toBeNull()
  })
})

const arcCard = (name: string, edition: string, number: string, categories: string[], quantity = 1) => ({
  quantity,
  categories,
  card: { collectorNumber: number, edition: { editioncode: edition }, oracleCard: { name } },
})

const ARCHIDEKT = {
  name: 'Kenrith',
  categories: [
    { name: 'Commander', includedInDeck: true, isPremier: true },
    { name: 'Ramp', includedInDeck: true, isPremier: false },
    { name: 'Land', includedInDeck: true, isPremier: false },
    { name: 'Maybeboard', includedInDeck: false, isPremier: false },
    { name: 'Sideboard', includedInDeck: false, isPremier: false },
  ],
  cards: [
    arcCard('Sol Ring', 'c21', '263', ['Ramp']),
    arcCard('Kenrith, the Returned King', 'eld', '303', ['Commander']),
    arcCard('Forest', 'eld', '266', ['Land'], 30),
    arcCard('Counterspell', 'mh2', '267', ['Maybeboard']),
    arcCard('Swords to Plowshares', 'sta', '10', ['Sideboard', 'Removal']),
    arcCard('Arcane Signet', 'eld', '331', []),
  ],
}

describe('archidektToText', () => {
  it('commandant d’après la catégorie « premier », cartes hors deck ignorées', () => {
    expect(archidektToText(ARCHIDEKT)).toBe(
      [
        'Commander',
        '1 Kenrith, the Returned King (eld) 303',
        '',
        'Deck',
        '1 Sol Ring (c21) 263',
        '30 Forest (eld) 266',
        '1 Arcane Signet (eld) 331',
      ].join('\n'),
    )
  })

  it('produit un texte lu sans erreur par l’import', () => {
    const parsed = parseDeckList(archidektToText(ARCHIDEKT)!)
    expect(parsed.errors).toEqual([])
    expect(parsed.lines.reduce((n, l) => n + l.quantity, 0)).toBe(33)
  })

  it('réponse inattendue → null', () => {
    expect(archidektToText({})).toBeNull()
    expect(archidektToText({ cards: [] })).toBeNull()
  })
})

const response = (status: number, body: unknown) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('fetchDeckLink', () => {
  it('Moxfield : appelle l’API du deck et renvoie le texte', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, MOXFIELD))
    const result = await fetchDeckLink({ site: 'moxfield', id: 'AbC12' }, fetcher)
    expect(fetcher.mock.calls[0][0]).toBe('https://api2.moxfield.com/v3/decks/all/AbC12')
    expect(result).toEqual({ ok: true, text: moxfieldToText(MOXFIELD), name: 'Kenrith go wide' })
  })

  it('Archidekt : appelle l’API du deck et renvoie le texte', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(200, ARCHIDEKT))
    const result = await fetchDeckLink({ site: 'archidekt', id: '42' }, fetcher)
    expect(fetcher.mock.calls[0][0]).toBe('https://archidekt.com/api/decks/42/')
    expect(result).toEqual({ ok: true, text: archidektToText(ARCHIDEKT), name: 'Kenrith' })
  })

  it('404 → deck introuvable ou privé', async () => {
    const result = await fetchDeckLink({ site: 'archidekt', id: '42' }, vi.fn().mockResolvedValue(response(404, {})))
    expect(result).toEqual({ ok: false, error: 'Deck introuvable ou privé sur Archidekt' })
  })

  it.each([
    ['refus', () => Promise.resolve(response(403, '<html>Just a moment…</html>'))],
    ['erreur serveur', () => Promise.resolve(response(503, {}))],
    ['réseau', () => Promise.reject(new TypeError('fetch failed'))],
    ['réponse illisible', () => Promise.resolve(response(200, '<html></html>'))],
  ])('Moxfield, %s → message avec le repli copier-coller', async (_, impl) => {
    const result = await fetchDeckLink({ site: 'moxfield', id: 'x' }, vi.fn().mockImplementation(impl))
    expect(result).toEqual({
      ok: false,
      error: 'Moxfield refuse la récupération automatique : sur Moxfield, fais Export → Copier, puis colle la liste ici',
    })
  })

  it('deck vide → message', async () => {
    const result = await fetchDeckLink({ site: 'archidekt', id: '42' }, vi.fn().mockResolvedValue(response(200, { cards: [] })))
    expect(result).toEqual({ ok: false, error: 'Aucune carte trouvée dans ce deck Archidekt' })
  })
})
