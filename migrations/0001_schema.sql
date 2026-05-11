CREATE TABLE IF NOT EXISTS players (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  moxfield_url TEXT,
  avatar_url   TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leagues (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  started_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at    TEXT,
  is_active   INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS decks (
  id                  TEXT PRIMARY KEY,
  player_id           TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  commander_image_url TEXT,
  moxfield_url        TEXT,
  created_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS league_players (
  league_id           TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id           TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  moxfield_url        TEXT,
  commander_image_url TEXT,
  deck_id             TEXT REFERENCES decks(id),
  PRIMARY KEY (league_id, player_id)
);

CREATE TABLE IF NOT EXISTS matches (
  id           TEXT PRIMARY KEY,
  player1_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player2_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score_p1     INTEGER,
  score_p2     INTEGER,
  is_completed INTEGER DEFAULT 0,
  round_number INTEGER DEFAULT 1,
  league_id    TEXT REFERENCES leagues(id),
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playoffs (
  id           TEXT PRIMARY KEY,
  stage        TEXT NOT NULL,
  player1_id   TEXT REFERENCES players(id) ON DELETE SET NULL,
  player2_id   TEXT REFERENCES players(id) ON DELETE SET NULL,
  score_p1     INTEGER,
  score_p2     INTEGER,
  is_completed INTEGER DEFAULT 0,
  league_id    TEXT REFERENCES leagues(id),
  created_at   TEXT DEFAULT (datetime('now'))
);
