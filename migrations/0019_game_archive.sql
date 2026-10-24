-- Historique des parties en ligne (issue #241) : une partie finie reste en D1 (vainqueur, durée, decks) ;
-- seul l'état de son Durable Object est effacé après 7 jours d'inactivité, et cette colonne note quand.
-- NULL : partie pas (encore) archivée.
ALTER TABLE game_tables ADD COLUMN game_archived_at TEXT;
