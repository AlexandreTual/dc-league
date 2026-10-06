-- Choix des images françaises revu (issue #89) : plus d'image provisoire « Localized Image Not Available »,
-- scan net d'une version classique de préférence, sinon image anglaise.
-- Le cache des recherches est vidé pour que chaque carte soit recherchée à nouveau au prochain import ;
-- les cartes déjà enregistrées et les decks ne changent qu'à leur réimport.
DELETE FROM card_lookups;
