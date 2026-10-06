-- Image « large » de Scryfall (672 × 936) pour l'aperçu agrandi, net sur écran haute densité (issue #20).
ALTER TABLE cards ADD COLUMN image_large TEXT;

-- Cache de recherche vidé : le prochain import d'un deck relit les cartes chez Scryfall, avec l'image large.
-- Les cartes déjà enregistrées (et donc les decks importés) restent intactes et gardent leur image.
DELETE FROM card_lookups;
