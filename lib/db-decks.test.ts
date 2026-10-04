import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { deleteDeck, getDeck, insertDeck, isDeckUsedInLeague, updateDeck } from './db-decks'

let db: D1Database
let deckId: string

beforeEach(async () => {
  db = createTestDb()
  await db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex')").run()
  deckId = (await insertDeck(db, 'p1', { name: 'Kenrith', moxfield_url: 'https://moxfield.com/decks/x', commander_image_url: 'https://img/k.png' })).data!.id
})

describe('getDeck', () => {
  it('renvoie le deck ou null', async () => {
    expect((await getDeck(db, deckId)).data?.name).toBe('Kenrith')
    expect((await getDeck(db, 'inconnu')).data).toBeNull()
  })
})

describe('updateDeck', () => {
  it('ne modifie que les champs fournis', async () => {
    const d = (await updateDeck(db, deckId, { name: 'Kenrith v2' })).data!
    expect(d).toMatchObject({ name: 'Kenrith v2', moxfield_url: 'https://moxfield.com/decks/x', commander_image_url: 'https://img/k.png' })
  })

  it('vide un champ explicitement null', async () => {
    const d = (await updateDeck(db, deckId, { moxfield_url: null })).data!
    expect(d.moxfield_url).toBeNull()
    expect(d.commander_image_url).toBe('https://img/k.png')
  })
})

describe('deleteDeck', () => {
  it('supprime un deck jamais utilisé', async () => {
    expect((await isDeckUsedInLeague(db, deckId)).data).toBe(false)
    expect((await deleteDeck(db, deckId)).error).toBeNull()
    expect((await getDeck(db, deckId)).data).toBeNull()
  })

  it('refuse un deck utilisé dans une ligue', async () => {
    await db.prepare("INSERT INTO leagues (id, name) VALUES ('l1', 'Saison 1')").run()
    await db.prepare("INSERT INTO league_players (league_id, player_id, deck_id) VALUES ('l1', 'p1', ?)").bind(deckId).run()
    expect((await isDeckUsedInLeague(db, deckId)).data).toBe(true)
    expect((await deleteDeck(db, deckId)).error).toBe('DECK_IN_USE')
    expect((await getDeck(db, deckId)).data).not.toBeNull()
  })
})
