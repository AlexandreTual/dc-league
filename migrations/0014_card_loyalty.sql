-- Loyauté imprimée des planeswalkers, affichée et modifiable sur la table comme la force et l'endurance.
-- NULL : pas encore lue chez Scryfall (carte enregistrée avant cette migration) ; elle est rattrapée
-- à l'ouverture du deck en mode test ou au lancement d'une partie. '' : la carte n'en a pas.
-- Celle de chaque face (cartes recto-verso) est dans la colonne JSON `faces`.
ALTER TABLE cards ADD COLUMN loyalty TEXT;
