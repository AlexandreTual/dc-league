-- Réglages du site modifiables par les admins sans redéployer (spec 2026-10-13-ai-card-assistant-design).
-- Première clé : ai_enabled ('1' / '0') ; ligne absente = activé.
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
