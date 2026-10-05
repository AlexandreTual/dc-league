import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { getLeagueDetail, listLeaguePlayers } from './db-leagues'

let db: D1Database

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex'), ('p2', 'Bob'), ('p3', 'Chloé')"),
    db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d1', 'p1', 'Kenrith'), ('d2', 'p2', 'Atraxa')"),
    db.prepare("INSERT INTO leagues (id, name) VALUES ('l1', 'Saison 1')"),
    db.prepare("INSERT INTO league_players (league_id, player_id, deck_id) VALUES ('l1', 'p1', 'd1'), ('l1', 'p2', 'd2'), ('l1', 'p3', NULL)"),
    db.prepare("INSERT INTO deck_cards (deck_id, position, quantity, section, requested_name) VALUES ('d1', 1, 1, 'main', 'Sol Ring')"),
  ])
})

const flags = (players: { player_id: string; deck_has_cards: boolean }[]) =>
  Object.fromEntries(players.map((p) => [p.player_id, p.deck_has_cards]))

describe('deck_has_cards', () => {
  it('listLeaguePlayers indique si le deck a une liste importée', async () => {
    expect(flags((await listLeaguePlayers(db, 'l1')).data!)).toEqual({ p1: true, p2: false, p3: false })
  })

  it('getLeagueDetail aussi', async () => {
    expect(flags((await getLeagueDetail(db, 'l1')).data!.leaguePlayers)).toEqual({ p1: true, p2: false, p3: false })
  })
})
