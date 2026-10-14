-- Questions posées à l'assistant IA, par compte et par jour de Paris (spec 2026-10-13-ai-card-assistant-design).
-- Seul le nombre est gardé : ni questions ni réponses.
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
