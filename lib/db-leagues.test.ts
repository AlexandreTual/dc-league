import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { enrollLeaguePlayer, listLeaguePlayers, removeLeaguePlayer } from './db-leagues'
import { ERREURS_LIGUE } from './db'

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
})

describe('inscriptions figées après la génération des matchs', () => {
  const genere = () => db.prepare("INSERT INTO matches (id, player1_id, player2_id, round_number, league_id) VALUES ('m1', 'p1', 'p2', 1, 'l1')").run()
  const inscrits = async () => (await listLeaguePlayers(db, 'l1')).data!.map((p) => p.player_id).sort()

  beforeEach(async () => {
    await db.prepare("INSERT INTO players (id, name) VALUES ('p4', 'Damien')").run()
  })

  it('enrollLeaguePlayer inscrit avant la génération, refuse après', async () => {
    expect((await enrollLeaguePlayer(db, 'l1', 'p4')).error).toBeNull()
    await removeLeaguePlayer(db, 'l1', 'p4')
    await genere()
    expect(await enrollLeaguePlayer(db, 'l1', 'p4')).toEqual({ data: null, error: ERREURS_LIGUE.matchesExist })
    expect(await inscrits()).toEqual(['p1', 'p2', 'p3'])
  })

  it('enrollLeaguePlayer rend l’inscription existante d’un joueur déjà inscrit, même après la génération', async () => {
    await genere()
    expect((await enrollLeaguePlayer(db, 'l1', 'p1')).data).toMatchObject({ league_id: 'l1', player_id: 'p1' })
  })

  it('removeLeaguePlayer désinscrit avant la génération, refuse après', async () => {
    expect((await removeLeaguePlayer(db, 'l1', 'p3')).error).toBeNull()
    expect(await inscrits()).toEqual(['p1', 'p2'])
    await genere()
    expect(await removeLeaguePlayer(db, 'l1', 'p2')).toEqual({ data: null, error: ERREURS_LIGUE.matchesExist })
    expect(await inscrits()).toEqual(['p1', 'p2'])
  })

  it('removeLeaguePlayer accepte un joueur déjà absent avant la génération', async () => {
    expect((await removeLeaguePlayer(db, 'l1', 'p4')).error).toBeNull()
  })
})
