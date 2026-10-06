-- Règles officielles (« rulings ») d'une carte, en cache par oracle_id (issue #70).
-- Identiques pour toutes les impressions d'une carte ; rafraîchies après quelques jours.
CREATE TABLE IF NOT EXISTS card_rulings (
  oracle_id  TEXT PRIMARY KEY,
  rulings    TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
