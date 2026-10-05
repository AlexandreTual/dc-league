import { describe, it, expect } from 'vitest'
import { createTestDb } from '@/test/d1'
import { listTables } from './db-games'

describe('listTables au-delà de 100 tables', () => {
  it('charge les joueurs de toutes les tables malgré la limite de paramètres de D1', async () => {
    const db = createTestDb()
    await db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex')").run()
    const n = 120
    await db.batch(
      Array.from({ length: n }, (_, i) => [
        db.prepare("INSERT INTO game_tables (id, host_player_id, format, seats) VALUES (?, 'p1', 'commander', 4)").bind(`t${i}`),
        db.prepare("INSERT INTO game_seats (table_id, player_id, seat) VALUES (?, 'p1', 1)").bind(`t${i}`),
      ]).flat(),
    )
    const { data, error } = await listTables(db)
    expect(error).toBeNull()
    expect(data).toHaveLength(n)
    expect(data!.every((t) => t.players.length === 1 && t.players[0].name === 'Alex')).toBe(true)
  })
})
