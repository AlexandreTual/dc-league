import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { generateRoundRobinMatches } from './leaderboard'
import { insertMatches, listMatches } from './db'

let db: D1Database

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`)

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    ...players(20).map((id) => db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, `Joueur ${id}`)),
    db.prepare("INSERT INTO leagues (id, name) VALUES ('l1', 'Saison 1')"),
  ])
})

describe('insertMatches', () => {
  it('génère une ligue de 15 joueurs (105 matchs) malgré la limite de paramètres de D1', async () => {
    const defs = generateRoundRobinMatches(players(15))
    expect(defs).toHaveLength(105)
    const { data, error } = await insertMatches(db, defs, 'l1')
    expect(error).toBeNull()
    expect(data).toHaveLength(105)
    expect((await listMatches(db, 'l1')).data).toHaveLength(105)
  })
})
