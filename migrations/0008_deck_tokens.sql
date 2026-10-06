-- Jetons créés par les cartes d'un deck (issue #41), proposés dans « Créer un jeton ».
-- Calculés à l'import du deck (ou par « Mettre à jour les jetons ») depuis les all_parts de Scryfall.
CREATE TABLE IF NOT EXISTS deck_tokens (
  deck_id           TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  token_scryfall_id TEXT NOT NULL,
  name              TEXT NOT NULL,
  type_line         TEXT NOT NULL,
  power             TEXT,
  toughness         TEXT,
  colors            TEXT NOT NULL DEFAULT '[]',
  image             TEXT,
  source_names      TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (deck_id, token_scryfall_id)
);
