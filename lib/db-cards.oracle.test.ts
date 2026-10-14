import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { cardRow } from '@/test/factories'
import { getCardsByOracle, upsertCards } from './db-cards'

const now = new Date('2026-10-13T12:00:00Z')
let db: D1Database
beforeEach(() => {
  db = createTestDb()
})

describe('getCardsByOracle', () => {
  it('donne la carte anglaise et la française de chaque oracle_id', async () => {
    const solEn = cardRow()
    const solFr = cardRow({ id: 'sol-c21-fr', lang: 'fr', printed_name: 'Anneau solaire' })
    const bolt = cardRow({ id: 'bolt-en', oracle_id: 'oracle-bolt', name: 'Lightning Bolt' })
    await upsertCards(db, [solEn, solFr, bolt], now)

    const { data, error } = await getCardsByOracle(db, ['oracle-sol', 'oracle-bolt', 'oracle-inconnu'])
    expect(error).toBeNull()
    expect(Object.keys(data!).sort()).toEqual(['oracle-bolt', 'oracle-sol'])
    expect(data!['oracle-sol'].en.id).toBe('sol-c21-en')
    expect(data!['oracle-sol'].fr?.printed_name).toBe('Anneau solaire')
    expect(data!['oracle-bolt'].fr).toBeNull()
  })

  it("ignore une carte connue seulement en français (pas de texte Oracle anglais)", async () => {
    await upsertCards(db, [cardRow({ id: 'fr-only', lang: 'fr' })], now)
    expect((await getCardsByOracle(db, ['oracle-sol'])).data).toEqual({})
  })

  it('découpe une longue liste sous la limite de paramètres de D1', async () => {
    const cards = Array.from({ length: 120 }, (_, i) => cardRow({ id: `c${i}`, oracle_id: `o${i}` }))
    await upsertCards(db, cards, now)
    const { data, error } = await getCardsByOracle(db, cards.map((c) => c.oracle_id))
    expect(error).toBeNull()
    expect(Object.keys(data!)).toHaveLength(120)
  })
})
