CREATE TABLE IF NOT EXISTS cards (
  id                TEXT PRIMARY KEY,
  oracle_id         TEXT NOT NULL,
  lang              TEXT NOT NULL,
  name              TEXT NOT NULL,
  printed_name      TEXT,
  set_code          TEXT NOT NULL,
  collector_number  TEXT NOT NULL,
  released_at       TEXT,
  mana_cost         TEXT,
  cmc               REAL NOT NULL DEFAULT 0,
  type_line         TEXT NOT NULL,
  printed_type_line TEXT,
  oracle_text       TEXT,
  printed_text      TEXT,
  colors            TEXT NOT NULL DEFAULT '[]',
  color_identity    TEXT NOT NULL DEFAULT '[]',
  image_normal      TEXT,
  image_small       TEXT,
  faces             TEXT,
  fetched_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cards_oracle ON cards(oracle_id, lang);

CREATE TABLE IF NOT EXISTS card_lookups (
  key        TEXT PRIMARY KEY,
  en_card_id TEXT REFERENCES cards(id),
  fr_card_id TEXT REFERENCES cards(id),
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deck_cards (
  deck_id          TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL,
  quantity         INTEGER NOT NULL,
  section          TEXT NOT NULL CHECK (section IN ('commander', 'main')),
  requested_name   TEXT NOT NULL,
  requested_set    TEXT,
  requested_number TEXT,
  en_card_id       TEXT REFERENCES cards(id),
  fr_card_id       TEXT REFERENCES cards(id),
  PRIMARY KEY (deck_id, position)
);
