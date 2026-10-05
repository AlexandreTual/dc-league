-- Adresse mail des comptes et des invitations, demandes « mot de passe oublié », boîte de test.
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE) WHERE email IS NOT NULL;
ALTER TABLE invitations ADD COLUMN email TEXT;
CREATE TABLE IF NOT EXISTS password_requests (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_requests_user ON password_requests(user_id, requested_at);
-- Boîte de test (MAIL_TEST=1, en local seulement) ; reste vide en production.
CREATE TABLE IF NOT EXISTS test_mails (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
