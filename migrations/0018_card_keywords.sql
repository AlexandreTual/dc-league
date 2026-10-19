-- Capacités imprimées des cartes (mots-clés anglais de Scryfall : « Flying »…), pour animer les créatures volantes
-- sur la table (issue #173). JSON ; NULL : pas encore lues chez Scryfall (carte enregistrée avant cette migration),
-- rattrapées à l'ouverture du deck en mode test ou au lancement d'une partie. '[]' : la carte n'en a pas.
-- Celles de chaque face (cartes recto-verso) sont dans la colonne JSON `faces`.
ALTER TABLE cards ADD COLUMN keywords TEXT;
-- Capacités des jetons d'un deck (même format) ; NULL pour les jetons enregistrés avant : rafraîchies au prochain import.
ALTER TABLE deck_tokens ADD COLUMN keywords TEXT;
