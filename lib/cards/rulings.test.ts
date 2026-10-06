import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, MIGRATIONS } from '@/test/d1'
import { cardRow } from '@/test/factories'
import { getStoredRulings, saveRulings, upsertCards } from '@/lib/db-cards'
import { ScryfallUnavailableError } from './scryfall'
import { isOracleId, loadRulings, RULINGS_MAX_AGE_MS } from './rulings'
import type { Ruling } from './types'

const ORACLE = '0f1b8f5a-3c3b-4f7e-9d2a-1a2b3c4d5e6f'
const now = new Date('2026-10-06T12:00:00Z')
const R1: Ruling = { date: '2019-10-04', source: 'wotc', text: 'First.' }
const R2: Ruling = { date: '2024-01-01', source: 'wotc', text: 'Second.' }

function fakeClient(answer: Ruling[] | 'down') {
  const calls: string[] = []
  return {
    calls,
    client: {
      async fetchRulings(id: string) {
        calls.push(id)
        if (answer === 'down') throw new ScryfallUnavailableError('HTTP 503')
        return answer
      },
    },
  }
}

let db: D1Database
beforeEach(async () => {
  db = createTestDb()
  await upsertCards(db, [
    cardRow({ id: 'kenrith-fr', oracle_id: ORACLE, lang: 'fr' }),
    cardRow({ id: 'kenrith-en', oracle_id: ORACLE, lang: 'en' }),
  ], now)
})

describe('loadRulings', () => {
  it('pas en cache : demandées à Scryfall (impression anglaise) puis gardées en cache', async () => {
    const { client, calls } = fakeClient([R1])
    expect(await loadRulings(db, client, ORACLE, now)).toEqual({ status: 'ok', rulings: [R1] })
    expect(calls).toEqual(['kenrith-en'])
    expect((await getStoredRulings(db, ORACLE)).data).toEqual({ rulings: [R1], fetched_at: now.toISOString() })
  })

  it('en cache et récentes : pas d’appel à Scryfall', async () => {
    await saveRulings(db, ORACLE, [R1], new Date(now.getTime() - RULINGS_MAX_AGE_MS + 60_000))
    const { client, calls } = fakeClient([R2])
    expect(await loadRulings(db, client, ORACLE, now)).toEqual({ status: 'ok', rulings: [R1] })
    expect(calls).toEqual([])
  })

  it('périmées : rafraîchies', async () => {
    await saveRulings(db, ORACLE, [R1], new Date(now.getTime() - RULINGS_MAX_AGE_MS - 60_000))
    const { client, calls } = fakeClient([R1, R2])
    expect(await loadRulings(db, client, ORACLE, now)).toEqual({ status: 'ok', rulings: [R1, R2] })
    expect(calls).toHaveLength(1)
    expect((await getStoredRulings(db, ORACLE)).data?.fetched_at).toBe(now.toISOString())
  })

  it('Scryfall indisponible sans cache : indisponible', async () => {
    const { client } = fakeClient('down')
    expect(await loadRulings(db, client, ORACLE, now)).toEqual({ status: 'unavailable' })
  })

  it('Scryfall indisponible avec un cache périmé : le cache est servi', async () => {
    await saveRulings(db, ORACLE, [R1], new Date('2020-01-01T00:00:00Z'))
    const { client } = fakeClient('down')
    expect(await loadRulings(db, client, ORACLE, now)).toEqual({ status: 'ok', rulings: [R1] })
  })

  it('carte jamais importée : inconnue, sans appel à Scryfall', async () => {
    const { client, calls } = fakeClient([R1])
    expect(await loadRulings(db, client, '11111111-2222-3333-4444-555555555555', now)).toEqual({ status: 'unknown' })
    expect(calls).toEqual([])
  })

  it('aucune règle : liste vide, gardée en cache', async () => {
    const { client } = fakeClient([])
    expect(await loadRulings(db, client, ORACLE, now)).toEqual({ status: 'ok', rulings: [] })
    expect((await getStoredRulings(db, ORACLE)).data?.rulings).toEqual([])
  })
})

describe('loadRulings sans la table card_rulings (migration pas encore appliquée)', () => {
  it('les règles viennent quand même de Scryfall', async () => {
    const old = createTestDb(MIGRATIONS.filter((f) => f < '0009'))
    await upsertCards(old, [cardRow({ id: 'kenrith-en', oracle_id: ORACLE, lang: 'en' })], now)
    const { client, calls } = fakeClient([R1])
    expect(await loadRulings(old, client, ORACLE, now)).toEqual({ status: 'ok', rulings: [R1] })
    expect(calls).toEqual(['kenrith-en'])
  })
})

describe('isOracleId', () => {
  it('lettres minuscules, chiffres et tirets seulement', () => {
    expect(isOracleId(ORACLE)).toBe(true)
    expect(isOracleId('oracle-sol')).toBe(true)
    expect(isOracleId('')).toBe(false)
    expect(isOracleId('A B')).toBe(false)
    expect(isOracleId(`${ORACLE}/../x`)).toBe(false)
  })
})
