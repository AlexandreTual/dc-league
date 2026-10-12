-- Plusieurs ligues en parallèle, créées par les joueurs (spec 2026-10-12-user-leagues-design).
-- Ligues existantes : publiques et sans organisateur, donc gérées par les admins comme avant.
ALTER TABLE leagues ADD COLUMN owner_player_id TEXT REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE leagues ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private'));
ALTER TABLE leagues ADD COLUMN invite_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_invite ON leagues(invite_token);
CREATE INDEX IF NOT EXISTS idx_leagues_owner ON leagues(owner_player_id);
CREATE INDEX IF NOT EXISTS idx_league_players_player ON league_players(player_id);
