-- Journal des erreurs de production, lisible dans l'administration (issue #242).
-- Borné : seules les ERROR_LOG_MAX dernières lignes sont gardées (lib/db-errors.ts).
-- source : 'navigateur' (page d'erreur), 'serveur' (route API), 'nettoyage' (nettoyage de nuit).
CREATE TABLE IF NOT EXISTS error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  digest TEXT,
  path TEXT,
  user_id TEXT
);
