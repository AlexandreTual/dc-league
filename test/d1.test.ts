import { describe, it, expect } from 'vitest'
import { createTestDb } from './d1'

describe('adaptateur D1 de test', () => {
  it('applique les migrations', async () => {
    const db = createTestDb()
    const row = await db.prepare("SELECT name FROM sqlite_master WHERE name = 'users'").first<{ name: string }>()
    expect(row?.name).toBe('users')
  })

  it('first renvoie null si aucune ligne', async () => {
    expect(await createTestDb().prepare('SELECT * FROM users WHERE id = ?').bind('x').first()).toBeNull()
  })

  it('run renvoie meta.changes', async () => {
    const db = createTestDb()
    const r = await db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'A')").run()
    expect(r.meta.changes).toBe(1)
  })

  it('batch est atomique', async () => {
    const db = createTestDb()
    await db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'A')").run()
    await expect(db.batch([
      db.prepare("INSERT INTO players (id, name) VALUES ('p2', 'B')"),
      db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'dup')"),
    ])).rejects.toThrow()
    expect(await db.prepare("SELECT id FROM players WHERE id = 'p2'").first()).toBeNull()
  })

  it('all renvoie results', async () => {
    const db = createTestDb()
    await db.prepare("INSERT INTO players (id, name) VALUES (?, ?)").bind('p1', 'A').run()
    const { results } = await db.prepare('SELECT id FROM players').all<{ id: string }>()
    expect(results).toEqual([{ id: 'p1' }])
  })
})
