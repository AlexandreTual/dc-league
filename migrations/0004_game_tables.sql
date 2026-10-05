CREATE TABLE IF NOT EXISTS game_tables (
  id                 TEXT PRIMARY KEY,
  host_player_id     TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  format             TEXT NOT NULL CHECK (format IN ('commander', 'duel')),
  seats              INTEGER NOT NULL CHECK (seats BETWEEN 2 AND 5),
  eliminated_see_all INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'playing', 'finished')),
  winner_player_id   TEXT REFERENCES players(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_game_tables_status ON game_tables(status, last_activity_at);

CREATE TABLE IF NOT EXISTS game_seats (
  table_id  TEXT NOT NULL REFERENCES game_tables(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  deck_id   TEXT REFERENCES decks(id) ON DELETE SET NULL,
  seat      INTEGER NOT NULL,
  PRIMARY KEY (table_id, player_id)
);
