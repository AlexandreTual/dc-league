import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { loadStandings } from './standings'

let db: D1Database

const match = (id: string, p1: string, p2: string, s1: number | null, s2: number | null, league = 'l1') =>
  db.prepare(
    'INSERT INTO matches (id, league_id, player1_id, player2_id, score_p1, score_p2, is_completed, round_number) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
  ).bind(id, league, p1, p2, s1, s2, s1 === null ? 0 : 1)

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name, created_at) VALUES ('p1', 'Zoé', '2026-01-01'), ('p2', 'Ana', '2026-01-02'), ('p3', 'Marc', '2026-01-03'), ('hors', 'Hors ligue', '2026-01-04')"),
    db.prepare("INSERT INTO leagues (id, name) VALUES ('l1', 'Saison 1'), ('l2', 'Saison 2')"),
    db.prepare("INSERT INTO league_players (league_id, player_id) VALUES ('l1', 'p1'), ('l1', 'p2'), ('l1', 'p3'), ('l2', 'hors')"),
  ])
})

describe('loadStandings', () => {
  it('rend les inscrits sans match à zéro, départagés par le tirage fixe de la ligue', async () => {
    const { data, error } = await loadStandings(db, 'l1')
    expect(error).toBeNull()
    expect(data!.played).toBe(0)
    expect(data!.standings.map((p) => [p.id, p.points, p.played])).toEqual([['p1', 0, 0], ['p2', 0, 0], ['p3', 0, 0]])
    expect(data!.standings[1]).toMatchObject({ name: 'Ana' })
  })

  it('compte les matchs joués de la ligue seulement', async () => {
    await db.batch([
      match('m1', 'p2', 'p1', 2, 0),
      match('m2', 'p3', 'p1', 1, 1),
      match('m3', 'p2', 'p3', null, null),
      match('m4', 'hors', 'hors', 2, 0, 'l2'),
    ])
    const { data } = await loadStandings(db, 'l1')
    expect(data!.played).toBe(2)
    expect(data!.standings.map((p) => [p.id, p.points, p.played])).toEqual([['p2', 3, 1], ['p3', 1, 1], ['p1', 1, 2]])
  })

  it('ignore un joueur non inscrit, même s’il a un match dans la ligue', async () => {
    await db.batch([match('m1', 'hors', 'p1', 2, 0), match('m2', 'p1', 'p2', 2, 1)])
    const { data } = await loadStandings(db, 'l1')
    expect(data!.standings.map((p) => p.id)).toEqual(['p1', 'p3', 'p2'])
    expect(data!.standings[0]).toMatchObject({ points: 3, played: 1 })
  })

  it('rend une erreur si la base ne répond pas', async () => {
    const broken = { prepare: () => { throw new Error('D1 indisponible') } } as unknown as D1Database
    expect(await loadStandings(broken, 'l1')).toEqual({ data: null, error: 'D1 indisponible' })
  })
})
