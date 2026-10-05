-- Index manquants et ON DELETE SET NULL sur game_tables.winner_player_id (issue #50).
--
-- Pas d'index unique contre les doublons (matchs, playoffs, ligue active) : on ne peut pas vérifier
-- ici que les données de production n'en contiennent pas déjà, et un index unique en échec ferait
-- échouer toute la migration. Les doublons sont empêchés par des insertions conditionnelles
-- atomiques dans lib/db.ts et lib/db-leagues.ts.

PRAGMA defer_foreign_keys = true;

CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_playoffs_league ON playoffs(league_id);
CREATE INDEX IF NOT EXISTS idx_decks_player ON decks(player_id);
CREATE INDEX IF NOT EXISTS idx_league_players_deck ON league_players(deck_id);

-- SQLite ne sait pas modifier une clé étrangère : on recrée game_tables, sur le schéma issu de
-- 0006_table_starting (statut « starting » compris).
-- game_seats référence game_tables avec ON DELETE CASCADE : supprimer l'ancienne table viderait les
-- places. On les met donc de côté, on supprime game_seats avant game_tables, puis on la recrée.
CREATE TABLE game_tables_new (
  id                 TEXT PRIMARY KEY,
  host_player_id     TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  format             TEXT NOT NULL CHECK (format IN ('commander', 'duel')),
  seats              INTEGER NOT NULL CHECK (seats BETWEEN 2 AND 5),
  eliminated_see_all INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'starting', 'playing', 'finished')),
  winner_player_id   TEXT REFERENCES players(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO game_tables_new (id, host_player_id, format, seats, eliminated_see_all, status, winner_player_id, created_at, last_activity_at)
  SELECT id, host_player_id, format, seats, eliminated_see_all, status, winner_player_id, created_at, last_activity_at
  FROM game_tables;

CREATE TABLE game_seats_copie (
  table_id  TEXT NOT NULL,
  player_id TEXT NOT NULL,
  deck_id   TEXT,
  seat      INTEGER NOT NULL
);
INSERT INTO game_seats_copie (table_id, player_id, deck_id, seat)
  SELECT table_id, player_id, deck_id, seat FROM game_seats;

DROP TABLE game_seats;
DROP TABLE game_tables;
ALTER TABLE game_tables_new RENAME TO game_tables;
CREATE INDEX IF NOT EXISTS idx_game_tables_status ON game_tables(status, last_activity_at);

CREATE TABLE game_seats (
  table_id  TEXT NOT NULL REFERENCES game_tables(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  deck_id   TEXT REFERENCES decks(id) ON DELETE SET NULL,
  seat      INTEGER NOT NULL,
  PRIMARY KEY (table_id, player_id)
);
INSERT INTO game_seats (table_id, player_id, deck_id, seat)
  SELECT table_id, player_id, deck_id, seat FROM game_seats_copie;
DROP TABLE game_seats_copie;
