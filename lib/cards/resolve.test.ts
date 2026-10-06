import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { getCards, getLookups, saveLookups } from '@/lib/db-cards'
import { ScryfallUnavailableError, type Identifier, type ScryfallCard } from './scryfall'
import type { ParsedLine } from './types'
import { resolveLines, type ImportClient } from './resolve'

const now = new Date('2026-10-04T12:00:00Z')

function sc(id: string, oracle: string, name: string, set: string, cn: string, lang = 'en'): ScryfallCard {
  return {
    id, oracle_id: oracle, lang, name, set, collector_number: cn, cmc: 1, type_line: 'Artifact',
    colors: [], color_identity: [], image_uris: { normal: `https://img/${id}.jpg`, small: `https://img/s/${id}.jpg` },
    ...(lang === 'fr' ? { printed_name: `${name} (FR)` } : {}),
  }
}

// Catalogue factice : impressions anglaises (une par défaut par nom) et françaises triées de la plus récente à la plus ancienne.
const EN = [
  sc('sol-c21', 'o-sol', 'Sol Ring', 'c21', '263'),
  sc('sol-cmr', 'o-sol', 'Sol Ring', 'cmr', '472'),
  sc('signet', 'o-signet', 'Arcane Signet', 'c21', '236'),
  sc('remora', 'o-remora', 'Mystic Remora', 'ice', '87'),
  sc('limdul', 'o-limdul', 'Lim-Dûl the Necromancer', 'hml', '12'),
  sc('fire-ice', 'o-fire-ice', 'Fire // Ice', 'mh2', '290'),
]
const FR = [
  sc('sol-cmr-fr', 'o-sol', 'Sol Ring', 'cmr', '472', 'fr'),
  sc('sol-c21-fr', 'o-sol', 'Sol Ring', 'c21', '263', 'fr'),
  sc('signet-fr', 'o-signet', 'Arcane Signet', 'c21', '236', 'fr'),
]

function fakeClient() {
  const calls = { collection: 0, search: 0, names: [] as string[] }
  const client: ImportClient = {
    async fetchCollection(ids: Identifier[]) {
      calls.collection++
      const cards: ScryfallCard[] = []
      const notFound: Identifier[] = []
      for (const id of ids) {
        calls.names.push(...('name' in id ? [id.name] : []))
        const plain = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        // Comme Scryfall : le nom « A // B » d'une carte double est introuvable, sa face avant suffit.
        const found =
          'name' in id
            ? id.name.includes(' // ')
              ? undefined
              : EN.find((c) => plain(c.name) === plain(id.name) || plain(c.name.split(' // ')[0]) === plain(id.name))
            : EN.find((c) => c.set === id.set && c.collector_number === id.collector_number)
        if (found) cards.push(found)
        else notFound.push(id)
      }
      return { cards, notFound }
    },
    async searchFrenchPrints(oracleIds: string[]) {
      calls.search++
      return FR.filter((c) => oracleIds.includes(c.oracle_id!))
    },
  }
  return { client, calls }
}

const line = (name: string, set: string | null = null, number: string | null = null, lineNumber = 1): ParsedLine => ({
  lineNumber, quantity: 1, name, set, number, section: 'main',
})

let db: D1Database
beforeEach(() => {
  db = createTestDb()
})

describe('resolveLines', () => {
  it('résout une carte avec édition, en français de la même édition', async () => {
    const { client } = fakeClient()
    const r = await resolveLines(db, client, [line('Sol Ring', 'C21', '263')], now)
    expect(r).toEqual({ resolved: 1, notFound: [] })
    const lookup = (await getLookups(db, ['sol ring|c21|263'])).data!['sol ring|c21|263']
    expect(lookup).toMatchObject({ key: 'sol ring|c21|263', en_card_id: 'sol-c21', fr_card_id: 'sol-c21-fr' })
    const cards = (await getCards(db, ['sol-c21', 'sol-c21-fr'])).data!
    expect(cards['sol-c21-fr'].printed_name).toBe('Sol Ring (FR)')
    expect(Object.keys(cards)).toHaveLength(2)
  })

  it('sans édition, prend la française la plus récente', async () => {
    const { client } = fakeClient()
    await resolveLines(db, client, [line('Sol Ring')], now)
    expect((await getLookups(db, ['sol ring||'])).data!['sol ring||'].fr_card_id).toBe('sol-cmr-fr')
  })

  it('sans version française, fr_card_id est null', async () => {
    const { client } = fakeClient()
    await resolveLines(db, client, [line('Mystic Remora')], now)
    expect((await getLookups(db, ['mystic remora||'])).data!['mystic remora||']).toMatchObject({
      key: 'mystic remora||', en_card_id: 'remora', fr_card_id: null,
    })
  })

  it('édition introuvable → nouvelle recherche par nom', async () => {
    const { client, calls } = fakeClient()
    await resolveLines(db, client, [line('Arcane Signet', 'XXX', '1')], now)
    expect(calls.collection).toBe(2)
    expect((await getLookups(db, ['arcane signet|xxx|1'])).data!['arcane signet|xxx|1'].en_card_id).toBe('signet')
  })

  it('carte introuvable : mémorisée et signalée', async () => {
    const { client } = fakeClient()
    const r = await resolveLines(db, client, [line('Sol Rnig'), line('Sol Ring', null, null, 2)], now)
    expect(r).toEqual({ resolved: 1, notFound: ['Sol Rnig'] })
    expect((await getLookups(db, ['sol rnig||'])).data!['sol rnig||'].en_card_id).toBeNull()
  })

  it('même nom avec deux éditions : deux impressions distinctes', async () => {
    const { client } = fakeClient()
    await resolveLines(db, client, [line('Sol Ring', 'C21', '263'), line('Sol Ring', 'CMR', '472', 2)], now)
    const lookups = (await getLookups(db, ['sol ring|c21|263', 'sol ring|cmr|472'])).data!
    expect(lookups['sol ring|c21|263'].en_card_id).toBe('sol-c21')
    expect(lookups['sol ring|cmr|472'].en_card_id).toBe('sol-cmr')
    expect(lookups['sol ring|cmr|472'].fr_card_id).toBe('sol-cmr-fr')
  })

  it('un second appel identique ne refait aucun appel réseau', async () => {
    const { client, calls } = fakeClient()
    const lines = [line('Sol Ring', 'C21', '263'), line('Mystic Remora', null, null, 2), line('Sol Rnig', null, null, 3)]
    const first = await resolveLines(db, client, lines, now)
    const before = { ...calls }
    const second = await resolveLines(db, client, lines, now)
    expect(calls).toEqual(before)
    expect(second).toEqual(first)
  })

  it('une clé en double dans le paquet n’est résolue qu’une fois', async () => {
    const { client, calls } = fakeClient()
    const r = await resolveLines(db, client, [line('Sol Ring'), line('sol ring', null, null, 2)], now)
    expect(calls).toMatchObject({ collection: 1, search: 1 })
    expect(r.resolved).toBe(2)
  })

  it('carte double « A // B » sans édition : recherche par la face avant', async () => {
    const { client, calls } = fakeClient()
    const r = await resolveLines(db, client, [line('Fire // Ice')], now)
    expect(r).toEqual({ resolved: 1, notFound: [] })
    expect(calls.names).toEqual(['Fire'])
  })

  it('compare les noms sans accents', async () => {
    const { client } = fakeClient()
    const r = await resolveLines(db, client, [line('Lim-Dul the Necromancer')], now)
    expect(r).toEqual({ resolved: 1, notFound: [] })
  })

  it('retente une entrée négative de plus de 7 jours, pas une plus récente', async () => {
    const { client, calls } = fakeClient()
    await saveLookups(db, [{ key: 'sol ring||', en_card_id: null, fr_card_id: null }], new Date('2026-09-30T12:00:00Z'))
    expect((await resolveLines(db, client, [line('Sol Ring')], now)).notFound).toEqual(['Sol Ring'])
    expect(calls.collection).toBe(0)

    await saveLookups(db, [{ key: 'sol ring||', en_card_id: null, fr_card_id: null }], new Date('2026-09-26T12:00:00Z'))
    expect((await resolveLines(db, client, [line('Sol Ring')], now)).notFound).toEqual([])
    expect(calls.collection).toBe(1)
    expect((await getLookups(db, ['sol ring||'])).data!['sol ring||']).toMatchObject({ en_card_id: 'sol-c21', fr_card_id: 'sol-cmr-fr' })
  })

  it('retente une carte sans version française après 7 jours', async () => {
    const { client, calls } = fakeClient()
    await resolveLines(db, client, [line('Mystic Remora')], new Date('2026-09-01T12:00:00Z'))
    expect(calls.search).toBe(1)
    await resolveLines(db, client, [line('Mystic Remora')], new Date('2026-09-05T12:00:00Z'))
    expect(calls.search).toBe(1)
    await resolveLines(db, client, [line('Mystic Remora')], now)
    expect(calls.search).toBe(2)
  })

  it('Scryfall indisponible pendant le rafraîchissement d’une entrée négative : le cache sert', async () => {
    const { client } = fakeClient()
    await resolveLines(db, client, [line('Mystic Remora')], new Date('2026-09-01T12:00:00Z'))
    const down: ImportClient = {
      fetchCollection: async () => { throw new ScryfallUnavailableError('HTTP 429') },
      searchFrenchPrints: async () => { throw new ScryfallUnavailableError('HTTP 429') },
    }
    expect(await resolveLines(db, down, [line('Mystic Remora')], now)).toEqual({ resolved: 1, notFound: [] })
    // une carte jamais vue ne peut pas être servie : l'erreur remonte
    await expect(resolveLines(db, down, [line('Mystic Remora'), line('Sol Ring', null, null, 2)], now)).rejects.toBeInstanceOf(
      ScryfallUnavailableError,
    )
  })

  it('garde une entrée positive (avec version française) quel que soit son âge', async () => {
    const { client, calls } = fakeClient()
    await resolveLines(db, client, [line('Sol Ring')], new Date('2025-01-01T12:00:00Z'))
    await resolveLines(db, client, [line('Sol Ring')], now)
    expect(calls.collection).toBe(1)
  })
})
