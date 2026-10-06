import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb, MIGRATIONS } from '@/test/d1'
import { cardRow } from '@/test/factories'
import { getCards, getLookups, saveLookups, upsertCards } from './db-cards'

const now = new Date('2026-10-04T12:00:00Z')

let db: D1Database
beforeEach(() => {
  db = createTestDb()
})

describe('cache de cartes', () => {
  it('upsertCards puis getCards relit une carte identique', async () => {
    const dfc = cardRow({
      id: 'delver',
      colors: ['U'],
      color_identity: ['U'],
      cmc: 1.5,
      faces: [
        { name: 'Delver of Secrets', printed_name: null, mana_cost: '{U}', type_line: 'Creature — Human Wizard', printed_type_line: null, oracle_text: 'x', printed_text: null, image_normal: 'a', image_small: 'b' },
        { name: 'Insectile Aberration', printed_name: null, mana_cost: '', type_line: 'Creature — Human Insect', printed_type_line: null, oracle_text: 'Flying', printed_text: null, image_normal: 'c', image_small: 'd' },
      ],
    })
    await upsertCards(db, [cardRow(), dfc], now)
    const cards = (await getCards(db, ['sol-c21-en', 'delver'])).data!
    expect(cards['sol-c21-en']).toEqual(cardRow())
    expect(cards.delver).toEqual(dfc)
  })

  it('upsertCards met à jour une carte existante', async () => {
    await upsertCards(db, [cardRow()], now)
    await upsertCards(db, [cardRow({ printed_name: 'Anneau solaire' })], now)
    expect((await getCards(db, ['sol-c21-en'])).data!['sol-c21-en'].printed_name).toBe('Anneau solaire')
  })

  it("saveLookups mémorise l'absence de version française et sa date", async () => {
    await upsertCards(db, [cardRow()], now)
    await saveLookups(db, [{ key: 'sol ring||', en_card_id: 'sol-c21-en', fr_card_id: null }], now)
    expect((await getLookups(db, ['sol ring||'])).data).toEqual({
      'sol ring||': { key: 'sol ring||', en_card_id: 'sol-c21-en', fr_card_id: null, fetched_at: now.toISOString() },
    })
  })

  it('base pas encore migrée (sans les colonnes d’images récentes) : la carte est enregistrée quand même', async () => {
    const old = createTestDb(MIGRATIONS.filter((f) => f < '0010'))
    expect((await upsertCards(old, [cardRow()], now)).error).toBeNull()
    expect((await getCards(old, ['sol-c21-en'])).data!['sol-c21-en']).toEqual(cardRow({ image_large: null }))
  })

  it('base migrée à moitié (image_large, pas encore image_status) : garde ce qui peut l’être', async () => {
    const half = createTestDb(MIGRATIONS.filter((f) => f < '0011'))
    const row = cardRow({ image_status: 'lowres', illustration_id: 'ill' })
    expect((await upsertCards(half, [row], now)).error).toBeNull()
    expect((await getCards(half, ['sol-c21-en'])).data!['sol-c21-en']).toEqual(cardRow())
  })

  it('getLookups ignore les clés inconnues et getCards([]) renvoie {}', async () => {
    expect((await getLookups(db, ['inconnue||'])).data).toEqual({})
    expect((await getCards(db, [])).data).toEqual({})
    expect((await getLookups(db, [])).data).toEqual({})
  })
})
