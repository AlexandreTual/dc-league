-- Force et endurance imprimées des cartes, affichées et modifiables sur la table (issue #110).
-- NULL : pas encore lues chez Scryfall (carte enregistrée avant cette migration) ; elles sont rattrapées
-- à l'ouverture du deck en mode test ou au lancement d'une partie. '' : la carte n'en a pas.
-- Celles de chaque face (cartes recto-verso) sont dans la colonne JSON `faces`.
ALTER TABLE cards ADD COLUMN power TEXT;
ALTER TABLE cards ADD COLUMN toughness TEXT;
