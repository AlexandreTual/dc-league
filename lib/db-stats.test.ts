import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { listMatchStats } from './db-stats'

let db: D1Database

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Ana'), ('p2', 'Bob')"),
    db.prepare("INSERT INTO leagues (id, name, visibility) VALUES ('pub', 'Publique', 'public'), ('priv', 'Privée', 'private')"),
    db.prepare(`INSERT INTO matches (id, player1_id, player2_id, league_id, score_p1, score_p2, is_completed)
      VALUES ('m-pub', 'p1', 'p2', 'pub', 2, 0, 1), ('m-priv', 'p1', 'p2', 'priv', 0, 2, 1)`),
  ])
})

describe('listMatchStats', () => {
  it('ne compte que les matchs des ligues publiques', async () => {
    expect((await listMatchStats(db)).data!.map((m) => m.id)).toEqual(['m-pub'])
  })
})
