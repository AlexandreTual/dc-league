import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { getCards, getLookups } from '@/lib/db-cards'
import type { Identifier, ScryfallCard, ScryfallClient } from './scryfall'
import type { ParsedLine } from './types'
import { resolveLines } from './resolve'

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
]
const FR = [
  sc('sol-cmr-fr', 'o-sol', 'Sol Ring', 'cmr', '472', 'fr'),
  sc('sol-c21-fr', 'o-sol', 'Sol Ring', 'c21', '263', 'fr'),
  sc('signet-fr', 'o-signet', 'Arcane Signet', 'c21', '236', 'fr'),
]

function fakeClient() {
  const calls = { collection: 0, search: 0 }
  const client: ScryfallClient = {
    async fetchCollection(ids: Identifier[]) {
      calls.collection++
      const cards: ScryfallCard[] = []
      const notFound: Identifier[] = []
      for (const id of ids) {
        const found =
          'name' in id
            ? EN.find((c) => c.name.toLowerCase() === id.name.toLowerCase())
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
    expect(lookup).toEqual({ key: 'sol ring|c21|263', en_card_id: 'sol-c21', fr_card_id: 'sol-c21-fr' })
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
    expect((await getLookups(db, ['mystic remora||'])).data!['mystic remora||']).toEqual({
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
    expect(calls).toEqual({ collection: 1, search: 1 })
    expect(r.resolved).toBe(2)
  })
})
