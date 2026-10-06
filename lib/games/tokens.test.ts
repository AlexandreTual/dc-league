import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { replaceDeckTokens } from '@/lib/db-cards'
import { chooseDeck, createTable, joinTable } from '@/lib/db-games'
import { myTableTokens } from './tokens'

let db: D1Database
let tableId: string

const token = (id: string, name: string) => ({ id, name, typeLine: 'Token Creature', power: '1', toughness: '1', colors: [], image: null, sources: [`Créateur de ${name}`] })

beforeEach(async () => {
  db = createTestDb()
  for (const [id, name] of [['p1', 'Alex'], ['p2', 'Bob'], ['p3', 'Chloé']]) {
    await db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, name).run()
    await db.prepare('INSERT INTO decks (id, player_id, name) VALUES (?, ?, ?)').bind(`d-${id}`, id, `Deck de ${name}`).run()
  }
  // Une carte doit être importée pour qu'un deck puisse être choisi.
  await db.prepare("INSERT INTO cards (id, oracle_id, lang, name, set_code, collector_number, type_line, fetched_at) VALUES ('c', 'o', 'en', 'Sol Ring', 'c21', '1', 'Artifact', '2026-10-04')").run()
  for (const d of ['d-p1', 'd-p2']) {
    await db.prepare("INSERT INTO deck_cards (deck_id, position, quantity, section, requested_name, en_card_id) VALUES (?, 1, 1, 'main', 'Sol Ring', 'c')").bind(d).run()
  }
  await replaceDeckTokens(db, 'd-p1', [token('t1', 'Soldat')])
  await replaceDeckTokens(db, 'd-p2', [token('t2', 'Zombie')])
  tableId = (await createTable(db, { hostPlayerId: 'p1', format: 'commander', seats: 3, eliminatedSeeAll: false })).data!.id
  await joinTable(db, tableId, 'p2')
  await chooseDeck(db, tableId, 'p1', 'd-p1')
  await chooseDeck(db, tableId, 'p2', 'd-p2')
})

describe('myTableTokens', () => {
  it('chaque joueur ne reçoit que les jetons de son propre deck', async () => {
    expect((await myTableTokens(db, tableId, 'p1')).data!.map((t) => t.name)).toEqual(['Soldat'])
    expect((await myTableTokens(db, tableId, 'p2')).data!.map((t) => t.name)).toEqual(['Zombie'])
  })

  it('un joueur qui n’est pas à la table n’en reçoit aucun', async () => {
    expect((await myTableTokens(db, tableId, 'p3')).data).toEqual([])
  })

  it('table inconnue', async () => {
    expect((await myTableTokens(db, 'nope', 'p1')).error).toBe('Table introuvable')
  })
})
