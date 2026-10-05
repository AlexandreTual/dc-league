import { describe, it, expect, beforeEach } from 'vitest'
import { MIGRATIONS, createTestDb, readMigration } from './d1'

const MIGRATION = '0007_ligue_index.sql'

/** Base au niveau 0006, avec des données comme en production. */
async function avantMigration(): Promise<D1Database> {
  const db = createTestDb(MIGRATIONS.slice(0, MIGRATIONS.indexOf(MIGRATION)))
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex'), ('p2', 'Bob'), ('p3', 'Chloé')"),
    db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d1', 'p1', 'Kenrith'), ('d2', 'p2', 'Atraxa')"),
    db.prepare(`INSERT INTO game_tables (id, host_player_id, format, seats, eliminated_see_all, status, winner_player_id, created_at, last_activity_at)
                VALUES ('t1', 'p1', 'commander', 4, 1, 'finished', 'p2', '2026-09-01 10:00:00', '2026-09-01 11:00:00'),
                       ('t2', 'p3', 'duel', 2, 0, 'open', NULL, '2026-09-02 10:00:00', '2026-09-02 10:30:00'),
                       ('t3', 'p2', 'duel', 2, 0, 'starting', NULL, '2026-09-03 10:00:00', '2026-09-03 10:00:00')`),
    db.prepare(`INSERT INTO game_seats (table_id, player_id, deck_id, seat)
                VALUES ('t1', 'p1', 'd1', 1), ('t1', 'p2', 'd2', 2), ('t2', 'p3', NULL, 1), ('t3', 'p2', 'd2', 1)`),
  ])
  return db
}

const tables = (db: D1Database) =>
  db.prepare('SELECT * FROM game_tables ORDER BY id').all<Record<string, unknown>>().then((r) => r.results)
const seats = (db: D1Database) =>
  db.prepare('SELECT * FROM game_seats ORDER BY table_id, seat').all<Record<string, unknown>>().then((r) => r.results)

describe('migration 0007', () => {
  let db: D1Database

  beforeEach(async () => {
    db = await avantMigration()
  })

  it('conserve les tables et les places existantes', async () => {
    const [tablesAvant, placesAvant] = [await tables(db), await seats(db)]
    await db.exec(readMigration(MIGRATION))
    expect(await tables(db)).toEqual(tablesAvant)
    expect(await seats(db)).toEqual(placesAvant)
  })

  it('permet de supprimer un joueur vainqueur d’une partie en ligne', async () => {
    await expect(db.prepare("DELETE FROM players WHERE id = 'p2'").run()).rejects.toThrow(/FOREIGN KEY/)
    await db.exec(readMigration(MIGRATION))
    await db.prepare("DELETE FROM players WHERE id = 'p2'").run()
    const t1 = await db.prepare("SELECT winner_player_id FROM game_tables WHERE id = 't1'").first<{ winner_player_id: string | null }>()
    expect(t1?.winner_player_id).toBeNull()
    expect((await seats(db)).map((s) => `${s.table_id}/${s.player_id}`)).toEqual(['t1/p1', 't2/p3'])
    // La table qu'il hébergeait part avec lui (ON DELETE CASCADE inchangé).
    expect((await tables(db)).map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('garde la suppression en cascade des places avec la table', async () => {
    await db.exec(readMigration(MIGRATION))
    await db.prepare("DELETE FROM game_tables WHERE id = 't1'").run()
    expect((await seats(db)).map((s) => s.table_id)).toEqual(['t2', 't3'])
  })

  it('ajoute les index attendus', async () => {
    await db.exec(readMigration(MIGRATION))
    const { results } = await db
      .prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%' ORDER BY name")
      .all<{ name: string; tbl_name: string }>()
    expect(results).toEqual(expect.arrayContaining([
      { name: 'idx_decks_player', tbl_name: 'decks' },
      { name: 'idx_game_tables_status', tbl_name: 'game_tables' },
      { name: 'idx_league_players_deck', tbl_name: 'league_players' },
      { name: 'idx_matches_league', tbl_name: 'matches' },
      { name: 'idx_playoffs_league', tbl_name: 'playoffs' },
    ]))
  })

  it('garde le statut « starting » de la migration 0006', async () => {
    await db.exec(readMigration(MIGRATION))
    await db.prepare("UPDATE game_tables SET status = 'starting' WHERE id = 't2'").run()
    await expect(db.prepare("UPDATE game_tables SET status = 'inconnu' WHERE id = 't2'").run()).rejects.toThrow(/CHECK/)
  })

  it('laisse un schéma sans violation de clé étrangère', async () => {
    await db.exec(readMigration(MIGRATION))
    const { results } = await db.prepare('PRAGMA foreign_key_check').all()
    expect(results).toEqual([])
  })
})
