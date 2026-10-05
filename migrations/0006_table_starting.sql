-- Statut « starting » : la table est réservée pendant le démarrage de la partie (issue #46).
-- SQLite ne sait pas modifier une contrainte CHECK : la table est reconstruite.
-- Supprimer game_tables efface les places en cascade : elles sont sauvegardées puis remises.
PRAGMA defer_foreign_keys = true;

CREATE TABLE game_seats_backup AS SELECT table_id, player_id, deck_id, seat FROM game_seats;

CREATE TABLE game_tables_new (
  id                 TEXT PRIMARY KEY,
  host_player_id     TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  format             TEXT NOT NULL CHECK (format IN ('commander', 'duel')),
  seats              INTEGER NOT NULL CHECK (seats BETWEEN 2 AND 5),
  eliminated_see_all INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'starting', 'playing', 'finished')),
  winner_player_id   TEXT REFERENCES players(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO game_tables_new (id, host_player_id, format, seats, eliminated_see_all, status, winner_player_id, created_at, last_activity_at)
  SELECT id, host_player_id, format, seats, eliminated_see_all, status, winner_player_id, created_at, last_activity_at FROM game_tables;

DROP TABLE game_tables;
ALTER TABLE game_tables_new RENAME TO game_tables;
CREATE INDEX IF NOT EXISTS idx_game_tables_status ON game_tables(status, last_activity_at);

DELETE FROM game_seats;
INSERT INTO game_seats (table_id, player_id, deck_id, seat) SELECT table_id, player_id, deck_id, seat FROM game_seats_backup;
DROP TABLE game_seats_backup;
