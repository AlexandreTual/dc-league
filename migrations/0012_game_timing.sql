-- Minuteur des parties en ligne (issue #101) : durée de la partie et temps de jeu de chaque joueur, en secondes.
-- Renseignés par le serveur de jeu à la fin de la partie ; NULL pour les parties finies avant (ou non horodatées).
ALTER TABLE game_tables ADD COLUMN duration_seconds INTEGER;
ALTER TABLE game_seats ADD COLUMN play_seconds INTEGER;
