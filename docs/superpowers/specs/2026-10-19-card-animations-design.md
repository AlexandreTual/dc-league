# Animations des cartes en jeu (légendaires, vol) — conception

Date : 2026-10-19
Statut : proposition, en attente du choix de l'effet légendaire
Maquette : https://claude.ai/artifact/AvkfDG78QDPF448bsiXiwn

## But

Rendre la table plus vivante sans gêner la lecture : un effet discret sur les **permanents légendaires** et une animation de
**lévitation** sur les **créatures avec le vol**, sur les champs de bataille (le mien, ceux des adversaires, fenêtre à part),
en mode test comme en ligne.

Hors champ de bataille (main, piles, aperçu, deck) : aucune animation.

## Effet légendaire

Une carte est légendaire si la ligne de type de sa face visible (recto, ou face affichée d'une carte transformée) contient
`Legendary` (version anglaise du catalogue, comme `lib/game/battlefield.ts`). Jetons : leur `typeLine`.

Deux variantes à départager sur la maquette :

- **A. Reflet** : liseré doré fin, et un reflet lumineux qui traverse la carte en diagonale toutes les ~7 s. Chaque carte a son
  propre décalage (tiré de son identifiant) pour que les légendaires ne brillent pas toutes en même temps.
- **B. Lueur** : liseré doré et halo doré qui « respire » lentement (~3,5 s).

Une carte légendaire engagée garde son effet.

## Vol

Une créature a le vol si le mot-clé `Flying` figure dans les **capacités imprimées** de sa face visible, fournies par Scryfall
(champ `keywords`). Pas de recherche dans le texte de la carte (« ne peut être bloquée que par des créatures avec le vol »
donnerait de faux positifs).

Animation : la carte flotte doucement (quelques pixels, ~3 s par aller-retour) au-dessus d'une ombre qui rétrécit quand elle
monte. Décalage propre à chaque carte, comme pour le reflet.

- Créature **engagée** : elle se pose (pas de lévitation, ombre fixe).
- Vol gagné en cours de partie (sort, équipement) : **non géré** — la table ne calcule pas les effets. Une éventuelle option
  manuelle « a le vol » ferait l'objet d'une autre issue.
- Jetons : `TokenData` reçoit `keywords?: string[]` (facultatif), rempli depuis Scryfall pour les jetons du deck. Jeton créé à
  la main : pas de vol (sauf si la liste « Du deck » le fournit).

### Données

- Migration `0018_card_keywords.sql` : `ALTER TABLE cards ADD COLUMN keywords TEXT;` (JSON, `NULL` = pas encore lu).
  Faces : `keywords` ajouté à chaque face du JSON `faces`.
- `toCardRow` garde `keywords` ; `CardRow.keywords?: string[] | null` (absent = carte enregistrée avant la migration ou serveur
  de jeu plus ancien).
- Rattrapage des cartes existantes comme pour la force/endurance (`lib/cards/stats.ts`) : relues chez Scryfall à l'ouverture
  du deck en mode test ou au lancement d'une partie, une fois par carte. Pas de réimport nécessaire.
- Le mot-clé ne concerne qu'une carte visible : aucune fuite d'information cachée (une carte face cachée ou cachée n'est ni
  légendaire ni volante à l'écran).

## Réglage et accessibilité

- Nouvelle case dans Réglages de la table : **« Animations des cartes »**, cochée par défaut, mémorisée sur l'appareil
  (`TableSettings.cardEffects`, absente d'une ancienne sauvegarde = cochée).
- `prefers-reduced-motion: reduce` : liseré doré seul pour les légendaires ; créature volante légèrement surélevée au-dessus
  de son ombre, immobile.
- Pendant un glisser, la carte déplacée n'est pas animée.

## Performances (tablette)

- CSS uniquement, animations limitées à `transform` et `opacity` (pas de `box-shadow` ni de `filter` animés) : le halo est
  un pseudo-élément dont on anime l'opacité, le reflet un dégradé déplacé par `transform`.
- Aucune minuterie JavaScript.
- À vérifier avec 30 cartes animées sur la tablette (1180×820).

## Compatibilité

- Serveur de jeu plus ancien : `keywords` absent ⇒ pas de vol, rien ne plante. L'effet légendaire ne dépend que de la ligne
  de type, déjà présente.
- Site déployé avant la migration (une à deux minutes) : la lecture de `keywords` tolère la colonne absente (comme 0012).

## Découpage proposé

1. Effet légendaire + case « Animations des cartes » + `prefers-reduced-motion` (sans migration).
2. Vol : migration, import et rattrapage des mots-clés, jetons, animation.

## Vérifications

- Vitest : détection légendaire (recto, face transformée, jeton, carte cachée), détection du vol (mots-clés, absents, face),
  lecture des réglages (ancienne sauvegarde), rattrapage des mots-clés.
- Navigateur : nouveau script `scripts/card-effects-check.mjs` (mode test, en ligne, tablette, réglage décoché, mouvement
  réduit) ; `playtest-check` et `online-check` toujours verts.
