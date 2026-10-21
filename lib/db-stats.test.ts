import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { listMatchStats, computeAllStats, type MatchStatsRow } from './db-stats'
import { computeLeaderboard } from './leaderboard'

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

function ligne(m: Partial<MatchStatsRow> & Pick<MatchStatsRow, 'player1_id' | 'player2_id' | 'score_p1' | 'score_p2'>): MatchStatsRow {
  return {
    id: `${m.player1_id}-${m.player2_id}`,
    league_id: 'l1',
    league_name: 'Saison 1',
    player1_name: m.player1_id.toUpperCase(),
    player2_name: m.player2_id.toUpperCase(),
    deck1_id: `deck-${m.player1_id}`, deck1_name: `Deck ${m.player1_id}`, deck1_image: null, deck1_moxfield: null,
    deck2_id: `deck-${m.player2_id}`, deck2_name: `Deck ${m.player2_id}`, deck2_image: null, deck2_moxfield: null,
    ...m,
  }
}

describe('computeAllStats', () => {
  it('compte 3 points pour une victoire, 1 pour un nul, et classe par points puis différence de manches', () => {
    const { players, totalMatches } = computeAllStats([
      ligne({ player1_id: 'a', player2_id: 'b', score_p1: 2, score_p2: 0 }),
      ligne({ player1_id: 'b', player2_id: 'c', score_p1: 1, score_p2: 1 }),
      ligne({ player1_id: 'c', player2_id: 'a', score_p1: 2, score_p2: 1 }),
    ])
    expect(totalMatches).toBe(3)
    expect(players.map((p) => p.player_id)).toEqual(['c', 'a', 'b'])
    const a = players.find((p) => p.player_id === 'a')!
    expect(a).toMatchObject({ player_name: 'A', points: 3, wins: 1, losses: 1, draws: 0, gw: 3, gl: 2, played: 2 })
    expect(a.decks).toEqual([expect.objectContaining({ deck_id: 'deck-a', points: 3, played: 2, league_names: ['Saison 1'] })])
  })

  it('cumule les points par deck et classe les decks par points puis par matchs joués', () => {
    const { players } = computeAllStats([
      ligne({ player1_id: 'a', player2_id: 'b', score_p1: 2, score_p2: 0, deck1_id: 'vieux', league_name: 'S1' }),
      ligne({ player1_id: 'a', player2_id: 'b', score_p1: 1, score_p2: 1, deck1_id: 'neuf', league_name: 'S2' }),
      ligne({ player1_id: 'b', player2_id: 'a', score_p1: 1, score_p2: 1, deck2_id: 'neuf', league_name: 'S2' }),
      ligne({ player1_id: 'a', player2_id: 'b', score_p1: 2, score_p2: 1, deck1_id: 'vieux', league_name: 'S3' }),
    ])
    const decks = players.find((p) => p.player_id === 'a')!.decks
    expect(decks.map((d) => [d.deck_id, d.points, d.played, d.league_names])).toEqual([
      ['vieux', 6, 2, ['S1', 'S3']],
      ['neuf', 2, 2, ['S2']],
    ])
  })

  it('regroupe les matchs sans deck sous un deck absent', () => {
    const { players } = computeAllStats([
      ligne({ player1_id: 'a', player2_id: 'b', score_p1: 2, score_p2: 0, deck1_id: null, deck1_name: null }),
      ligne({ player1_id: 'b', player2_id: 'a', score_p1: 0, score_p2: 2, deck2_id: null, deck2_name: null }),
    ])
    expect(players.find((p) => p.player_id === 'a')!.decks).toEqual([
      expect.objectContaining({ deck_id: null, deck_name: null, points: 6, played: 2, wins: 2 }),
    ])
  })

  it('compte les confrontations directes dans les deux sens, quel que soit l’ordre des identifiants', () => {
    const { h2h } = computeAllStats([
      ligne({ player1_id: 'zoe', player2_id: 'ana', score_p1: 2, score_p2: 0 }),
      ligne({ player1_id: 'ana', player2_id: 'zoe', score_p1: 2, score_p2: 1 }),
      ligne({ player1_id: 'zoe', player2_id: 'ana', score_p1: 0, score_p2: 2 }),
      ligne({ player1_id: 'ana', player2_id: 'zoe', score_p1: 1, score_p2: 1 }),
      ligne({ player1_id: 'zoe', player2_id: 'bob', score_p1: 0, score_p2: 2 }),
    ])
    expect(h2h).toEqual([
      { player_a_id: 'ana', player_a_name: 'ANA', player_b_id: 'zoe', player_b_name: 'ZOE', a_wins: 2, b_wins: 1, draws: 1 },
      { player_a_id: 'bob', player_a_name: 'BOB', player_b_id: 'zoe', player_b_name: 'ZOE', a_wins: 1, b_wins: 0, draws: 0 },
    ])
  })

  it('donne les mêmes points et le même ordre que le classement de ligue', () => {
    const matchs: Array<[string, string, number, number]> = [
      ['a', 'b', 2, 0], ['c', 'd', 1, 1], ['a', 'c', 0, 2], ['b', 'd', 2, 1],
      ['a', 'd', 1, 1], ['b', 'c', 2, 1], ['e', 'a', 2, 1], ['e', 'b', 0, 2],
    ]
    const ids = ['a', 'b', 'c', 'd', 'e']
    const classement = computeLeaderboard(
      ids.map((id) => ({ id, name: id, avatar_url: null, created_at: '' })),
      matchs.map(([p1, p2, s1, s2], i) => ({
        id: `m${i}`, player1_id: p1, player2_id: p2, score_p1: s1, score_p2: s2, is_completed: true, round_number: 1,
      })),
      'ligue',
    )
    const { players } = computeAllStats(matchs.map(([p1, p2, s1, s2]) => ligne({ player1_id: p1, player2_id: p2, score_p1: s1, score_p2: s2 })))

    const resume = (r: { points: number; wins: number; losses: number; draws: number; gw: number; gl: number; played: number }) =>
      [r.points, r.wins, r.losses, r.draws, r.gw, r.gl, r.played]
    expect(players.map((p) => p.player_id)).toEqual(classement.map((s) => s.id))
    expect(players.map(resume)).toEqual(classement.map(resume))
  })
})
