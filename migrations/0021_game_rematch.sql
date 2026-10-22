-- Revanche (issue #244) : une partie finie note la table de sa revanche, pour que les autres joueurs la rejoignent.
-- NULL : pas (encore) de revanche proposée. Une revanche supprimée (tous partis) peut être reproposée.
ALTER TABLE game_tables ADD COLUMN rematch_table_id TEXT;
