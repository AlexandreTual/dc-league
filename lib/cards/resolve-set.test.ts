import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { getLookups } from '@/lib/db-cards'
import type { Identifier, ScryfallCard } from './scryfall'
import { lookupKey } from './parse'
import { resolveLines, type ImportClient } from './resolve'

// Édition sans numéro (« 1 Sol Ring (CMR) ») : recherche par nom plus édition, puis par nom seul.
const now = new Date('2026-10-21T12:00:00Z')

const sc = (id: string, set: string, cn: string): ScryfallCard => ({
  id, oracle_id: 'o-sol', lang: 'en', name: 'Sol Ring', set, collector_number: cn, cmc: 1, type_line: 'Artifact',
  colors: [], color_identity: [], image_uris: { normal: `https://img/${id}.jpg`, small: `https://img/s/${id}.jpg` },
})
// La première impression est celle que Scryfall rend pour une recherche par nom seul.
const EN = [sc('sol-c21', 'c21', '263'), sc('sol-cmr', 'cmr', '472')]

function fakeClient() {
  const asked: Identifier[] = []
  const client: ImportClient = {
    async fetchCollection(ids: Identifier[]) {
      asked.push(...ids)
      const cards: ScryfallCard[] = []
      for (const id of ids) {
        const found = 'name' in id
          ? EN.find((c) => c.name === id.name && (!('set' in id) || c.set === id.set))
          : undefined
        if (found) cards.push(found)
      }
      return { cards, notFound: [] }
    },
    async searchFrenchPrints() {
      return []
    },
  }
  return { client, asked }
}

const line = (set: string) => ({ lineNumber: 1, quantity: 1, name: 'Sol Ring', set, number: null, section: 'main' as const })

let db: D1Database
beforeEach(() => {
  db = createTestDb()
})

describe('resolveLines : édition sans numéro', () => {
  it('cherche par nom et édition', async () => {
    const { client, asked } = fakeClient()
    const r = await resolveLines(db, client, [line('CMR')], now)
    expect(r).toEqual({ resolved: 1, notFound: [] })
    expect(asked[0]).toEqual({ name: 'Sol Ring', set: 'cmr' })
    expect((await getLookups(db, [lookupKey(line('CMR'))])).data![lookupKey(line('CMR'))].en_card_id).toBe('sol-cmr')
  })

  it('édition inconnue : retombe sur la recherche par nom', async () => {
    const { client, asked } = fakeClient()
    const r = await resolveLines(db, client, [line('ZZZ')], now)
    expect(r).toEqual({ resolved: 1, notFound: [] })
    expect(asked).toEqual([{ name: 'Sol Ring', set: 'zzz' }, { name: 'Sol Ring' }])
    expect((await getLookups(db, [lookupKey(line('ZZZ'))])).data![lookupKey(line('ZZZ'))].en_card_id).toBe('sol-c21')
  })
})
