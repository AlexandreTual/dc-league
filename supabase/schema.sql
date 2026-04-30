-- ============================================================
-- Commander League Manager — Supabase Schema
-- À exécuter dans l'éditeur SQL de ton projet Supabase
-- ============================================================

-- ── Players ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  moxfield_url TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Matches ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player1_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player2_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score_p1     INTEGER,
  score_p2     INTEGER,
  is_completed BOOLEAN DEFAULT FALSE,
  round_number INTEGER DEFAULT 1,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches  ENABLE ROW LEVEL SECURITY;

-- Lecture publique (anon peut lire)
CREATE POLICY "public_read_players"
  ON players FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "public_read_matches"
  ON matches FOR SELECT
  TO anon
  USING (true);

-- Toutes les écritures passent par les API routes côté serveur
-- avec la SERVICE_ROLE_KEY qui bypass le RLS.
-- Aucune politique d'écriture pour anon n'est nécessaire.

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matches_player1 ON matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_matches_player2 ON matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_round   ON matches(round_number);
CREATE INDEX IF NOT EXISTS idx_matches_completed ON matches(is_completed);
