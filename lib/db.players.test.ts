import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { deletePlayer, PLAYER_ERR } from './db'

let db: D1Database

const count = async (sql: string) => Number((await db.prepare(sql).first<{ n: number }>())?.n ?? 0)

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex')"),
    db.prepare("INSERT INTO players (id, name) VALUES ('p2', 'Bob')"),
    db.prepare("INSERT INTO players (id, name) VALUES ('p3', 'Chloé')"),
    db.prepare("INSERT INTO users (id, player_id, username, is_admin) VALUES ('u1', 'p1', 'alex', 1)"),
    db.prepare("INSERT INTO users (id, player_id, username, is_admin) VALUES ('u2', 'p2', 'bob', 0)"),
  ])
})

describe('deletePlayer', () => {
  it('refuse de supprimer le joueur du dernier admin', async () => {
    expect(await deletePlayer(db, 'p1')).toEqual({ data: null, error: PLAYER_ERR.LAST_ADMIN })
    expect(await count("SELECT COUNT(*) AS n FROM players WHERE id = 'p1'")).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1')).toBe(1)
  })

  it("supprime un admin s'il en reste un autre", async () => {
    await db.prepare("UPDATE users SET is_admin = 1 WHERE id = 'u2'").run()
    expect((await deletePlayer(db, 'p1')).error).toBeNull()
    expect(await count('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1')).toBe(1)
  })

  it('supprime un joueur non admin et son compte', async () => {
    expect((await deletePlayer(db, 'p2')).error).toBeNull()
    expect(await count("SELECT COUNT(*) AS n FROM users WHERE id = 'u2'")).toBe(0)
  })

  it('supprime un joueur sans compte', async () => {
    expect((await deletePlayer(db, 'p3')).error).toBeNull()
    expect(await count("SELECT COUNT(*) AS n FROM players WHERE id = 'p3'")).toBe(0)
  })

  it('refuse un joueur qui a participé à une ligue', async () => {
    await db.batch([
      db.prepare("INSERT INTO leagues (id, name) VALUES ('l1', 'Saison 1')"),
      db.prepare("INSERT INTO league_players (league_id, player_id) VALUES ('l1', 'p3')"),
    ])
    expect((await deletePlayer(db, 'p3')).error).toBe(PLAYER_ERR.HAS_HISTORY)
  })
})
