import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { cardRow, seedCache } from '@/test/factories'
import { countDeckCards, listDeckCards, replaceDeckCards, setCommander } from './db-cards'

let db: D1Database

const sol = cardRow()
const solFr = cardRow({ id: 'sol-c21-fr', lang: 'fr', printed_name: 'Anneau solaire' })
const kenrith = cardRow({ id: 'kenrith', name: 'Kenrith, the Returned King', type_line: 'Legendary Creature — Human Noble' })

const row = (position: number, quantity: number, name: string, en: string | null, fr: string | null = null, section: 'main' | 'commander' = 'main') => ({
  position, quantity, section, requested_name: name, requested_set: null, requested_number: null, en_card_id: en, fr_card_id: fr,
})

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex')"),
    db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d1', 'p1', 'Kenrith')"),
    db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d2', 'p1', 'Vide')"),
  ])
  await seedCache(db, [
    { key: 'sol ring||', en: sol, fr: solFr },
    { key: 'kenrith, the returned king||', en: kenrith },
  ])
})

describe('replaceDeckCards', () => {
  it('remplace tout le contenu', async () => {
    await replaceDeckCards(db, 'd1', [row(1, 1, 'Sol Ring', sol.id), row(2, 1, 'Kenrith', kenrith.id)])
    await replaceDeckCards(db, 'd1', [row(1, 1, 'Kenrith', kenrith.id)])
    expect((await listDeckCards(db, 'd1')).data!.map((c) => c.requested_name)).toEqual(['Kenrith'])
  })

  it('accepte la même carte sur deux lignes', async () => {
    const r = await replaceDeckCards(db, 'd1', [row(1, 1, 'Sol Ring', sol.id), row(2, 30, 'Sol Ring', sol.id)])
    expect(r.error).toBeNull()
    expect((await listDeckCards(db, 'd1')).data).toHaveLength(2)
  })
})

describe('listDeckCards', () => {
  it('joint les versions EN et FR, et null pour une carte introuvable', async () => {
    await replaceDeckCards(db, 'd1', [row(2, 1, 'Sol Rnig', null), row(1, 1, 'Sol Ring', sol.id, solFr.id)])
    const cards = (await listDeckCards(db, 'd1')).data!
    expect(cards.map((c) => c.position)).toEqual([1, 2])
    expect(cards[0]).toMatchObject({ quantity: 1, section: 'main', requested_name: 'Sol Ring' })
    expect(cards[0].en).toEqual(sol)
    expect(cards[0].fr).toEqual(solFr)
    expect(cards[1]).toMatchObject({ en: null, fr: null })
  })
})

describe('countDeckCards', () => {
  it('additionne les quantités et omet les decks vides', async () => {
    await replaceDeckCards(db, 'd1', [row(1, 1, 'Sol Ring', sol.id), row(2, 30, 'Forest', null)])
    expect((await countDeckCards(db, ['d1', 'd2'])).data).toEqual({ d1: 31 })
    expect((await countDeckCards(db, [])).data).toEqual({})
  })
})

describe('setCommander', () => {
  beforeEach(async () => {
    await replaceDeckCards(db, 'd1', [row(1, 1, 'Sol Ring', sol.id), row(2, 1, 'Kenrith', kenrith.id), row(3, 1, 'Sol Rnig', null)])
  })

  it('déplace une carte légendaire en commandant', async () => {
    const r = await setCommander(db, 'd1', 2)
    expect(r.data?.id).toBe('kenrith')
    expect((await listDeckCards(db, 'd1')).data!.find((c) => c.position === 2)?.section).toBe('commander')
  })

  it('refuse une carte non légendaire', async () => {
    expect((await setCommander(db, 'd1', 1)).error).toBe('NOT_LEGENDARY')
  })

  it('refuse une position inconnue ou une carte introuvable', async () => {
    expect((await setCommander(db, 'd1', 99)).error).toBe('NOT_FOUND')
    expect((await setCommander(db, 'd1', 3)).error).toBe('NOT_FOUND')
  })
})
