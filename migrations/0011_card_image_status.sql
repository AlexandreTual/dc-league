-- Numérisation Scryfall de l'impression et son illustration : une impression floue (foil, promo, Secret Lair,
-- The List…) prend l'image d'une impression nette de même illustration (issue #20).
ALTER TABLE cards ADD COLUMN image_status TEXT;
ALTER TABLE cards ADD COLUMN illustration_id TEXT;

-- Cache de recherche vidé : le prochain import d'un deck relit les cartes chez Scryfall.
-- Les cartes déjà enregistrées (et donc les decks importés) restent intactes et gardent leur image.
DELETE FROM card_lookups;
