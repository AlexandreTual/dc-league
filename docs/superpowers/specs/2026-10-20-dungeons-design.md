# Donjons : jeton, plan des salles et animation — conception

Date : 2026-10-20
Statut : réalisée (issue #193)

## But

Jouer les donjons de Magic à la table comme sur papier : « explorer le donjon » (*venture into the dungeon*, Forgotten
Realms) et l'initiative (*the initiative*, la Bataille de la Porte de Baldur), avec un jeton qui avance de salle en salle,
le plan du donjon et le texte de chaque salle. Le moteur suit la position de chacun ; il n'applique pas l'effet des
salles : on lit le texte et on l'applique à la main, comme le reste.

## Règles suivies (règles complètes 309, 701.49 et 725)

- **Explorer le donjon** (701.49a-b) : un joueur sans donjon dans sa zone de commandement choisit l'un de ses donjons
  « hors de la partie » et entre dans la première salle ; sinon il avance d'une salle, en choisissant le chemin quand la
  salle en propose deux. On ne peut choisir que les trois donjons de Forgotten Realms : **Mine oubliée de Phancreux**,
  **Tombe de l'annihilation**, **Donjon du mage dément**. Jamais **Les Souterrains** (309.3, 701.49d) : on n'y entre
  qu'avec l'initiative.
- **Explorer Les Souterrains** (701.49c) : sans donjon, le joueur entre dans Les Souterrains ; s'il a déjà un donjon
  commencé (n'importe lequel), il avance dans celui-là.
- **Initiative** (725) : prendre l'initiative fait explorer Les Souterrains, même si on l'avait déjà ; au début de
  l'entretien du joueur qui a l'initiative, il explore Les Souterrains.
- **Donjon terminé** (309.7, 704.5t) : quand le jeton est sur la dernière salle et que son effet est résolu, le donjon
  quitte la partie : le joueur a « terminé un donjon » (Acererak, Sefris, Gloom Stalker… comptent les donjons
  terminés). La fois suivante, il en recommence un (au choix, ou Les Souterrains avec l'initiative).

## Décisions

Décisions du propriétaire (19 octobre, issue #193) : les quatre donjons ; au début du tour du joueur qui a l'initiative,
l'avance est **proposée avec un bouton**, pas automatique ; l'animation est coupée par la case « Donjon » de la fenêtre
« Animations ».

Décisions prises pendant la réalisation (le propriétaire dormait, à revoir au besoin) :

1. **Prise d'initiative** : comme au début du tour, l'exploration des Souterrains est proposée par un bouton (pas
   automatique), par cohérence. Prendre l'initiative quand on l'a déjà (interrupteur éteint puis rallumé) la propose
   aussi.
2. **Proposition** : bandeau « Initiative : explorer Les Souterrains ? » en haut de la table, chez le joueur concerné
   seulement, avec **Explorer** et **Plus tard**. Elle reste tant qu'il n'a pas exploré Les Souterrains ou cliqué
   « Plus tard » (rechargement, annulation : elle revient avec l'état). Une seule proposition par joueur à la fois :
   deux occasions non jouées (prise d'initiative puis début de tour) n'en font qu'une ; le bouton « Explorer Les
   Souterrains » de la bulle reste là pour une seconde avance.
3. **« Explorer le donjon »** : dans la bulle « ⋯ » de **mon** portrait, rubrique « Donjon » : « Explorer le donjon »,
   « Explorer Les Souterrains » et « Voir le plan ». Chacun n'explore que pour soi (comme sur papier, c'est son propre
   donjon) ; les autres voient le jeton et le plan.
4. **Donjon terminé** : à l'arrivée sur la dernière salle, le moteur compte le donjon terminé tout de suite (son effet est
   appliqué à la main par le joueur). Le jeton reste affiché sur la dernière salle, marqué « terminé », jusqu'à la
   prochaine exploration, qui en recommence un : on voit ainsi le texte de la dernière salle.
5. **Noms et textes français** : Scryfall et Gatherer n'étaient pas joignables depuis l'environnement de développement ;
   les noms des donjons et des salles viennent des fiches françaises des cartes (Magic Corporation, Lotus Noir,
   Gatherer cité par la recherche), les textes sont ceux des cartes, dans la formulation française officielle (« Regard
   1. », « Créez un jeton Trésor. »…). Le plan des salles (liaisons) suit les cartes imprimées. Données en dur dans
   `lib/game/dungeons.ts`, avec les noms anglais (pas de migration).
6. **Annulation** : chaque exploration est une action, annulable comme les autres (« Annuler » / Ctrl+Z).
7. **Pas de choix pour un autre joueur** : un adversaire ne peut ni faire explorer ni retirer le donjon de quelqu'un.
   Un donjon ne se retire pas à la main (il quitte la partie seulement terminé), comme sur papier.

## Moteur

- `lib/game/dungeons.ts` : les quatre donjons (`phandelver`, `annihilation`, `madMage`, `undercity`), chacun avec son nom
  français et anglais, et ses salles (nom, nom anglais, texte français, salles suivantes, rangée et place dans la
  rangée pour le plan) ; `ventureStep` (pur) : ce que donne une exploration (entrer, avancer, choix du donjon ou du
  chemin à faire).
- `PlayerState.dungeon?: { id, room }` : donjon en cours et salle du jeton ; absent : jamais entré. Sur la dernière salle,
  le donjon est terminé (voir décision 4). `PlayerState.dungeonsDone?: number` : donjons terminés.
- `GameState.ventureOffers?: string[]` : joueurs à qui l'exploration des Souterrains est proposée. Ajouté par
  `setInitiative` vers un joueur et au passage du tour vers le joueur qui a l'initiative ; retiré quand il explore Les
  Souterrains ou passe.
- Action `{ type: 'venture', undercity?: true, dungeon?, room? }` : explore pour son auteur. `undercity` : Les
  Souterrains (initiative), sinon le donjon. `dungeon` : donjon choisi quand il faut en commencer un (refusé sinon) ;
  `room` : salle suivante quand il y en a deux (obligatoire alors). Messages : « Choisis un donjon », « On n'entre dans
  Les Souterrains qu'avec l'initiative », « Choisis la salle suivante », « Cette salle n'est pas accessible d'ici »…
- Action `{ type: 'skipVenture' }` : « Plus tard ». Refusée sans proposition ; journal « n'explore pas Les Souterrains
  pour l'instant ».
- Journal, une ligne par déplacement : « entre dans la Mine oubliée de Phancreux : Entrée du souterrain — Regard 1. »,
  « avance dans … : Réserve — … », et à la fin « … — Piochez une carte. Donjon terminé (2 au total). »
- Vue : tout est public ; `dungeon` et `dungeonsDone` suivent l'état du joueur, `ventureOffers` est envoyé à tous.
- Serveur de jeu plus ancien : les champs manquent (aucun jeton, aucune proposition) ; une exploration est refusée par
  « Action inconnue », affichée en rouge comme les autres refus.

## Table

- **Jeton** sous le portrait (colonne, en-tête des bandeaux d'adversaires, fenêtre à part) : pastille avec une tour,
  le nom court du donjon et la salle ; une piste de points, un par étage du donjon, où le jeton glisse ; « ✓ N » pour
  les donjons terminés. Toucher la pastille ouvre le plan. Rien sans donjon commencé ni terminé.
- **Plan** (fenêtre « Donjons ») : onglets des quatre donjons (celui du joueur ouvert d'abord) ; les salles en étages,
  reliées par des traits ; les jetons de tous les joueurs qui sont dans ce donjon (initiale, couleur du joueur) ; la
  salle choisie (au départ, celle du joueur) est détaillée sous le plan (nom, nom anglais, texte). Quand c'est à moi
  d'explorer : « Entrer dans ce donjon » sur l'onglet d'un donjon au choix, ou les salles suivantes en surbrillance,
  à toucher puis « Avancer ici ». Cibles de 44 px sur tablette.
- Exploration sans choix (une seule salle suivante, ou entrée dans Les Souterrains) : envoyée directement, sans ouvrir
  le plan ; avec un choix, le plan s'ouvre sur ce choix.

## Animation

Seuls `transform` et `opacity` sont animés ; jamais au premier affichage (ouverture de la page, reconnexion) : seulement
quand le jeton change de salle sous les yeux du joueur.

- Le jeton glisse jusqu'à la nouvelle salle (piste du portrait et plan), la salle atteinte s'allume (halo doré qui
  pulse une fois).
- Donjon terminé : éclat doré et « Donjon terminé » qui monte au-dessus du portrait.
- Mouvement réduit : pas de glissement ni de pulsation ; la salle atteinte reste mise en valeur, « Donjon terminé »
  s'affiche fixe un instant.
- Case « Donjon » décochée (fenêtre « Animations », `effects.dungeon`) : aucune animation, le jeton est simplement à sa
  place.

## Vérifications

Tests Vitest (données, `ventureStep`, moteur, validation, vue), `scripts/dungeon-check.mjs` (mode test, tablette, en
ligne à deux joueurs, serveur de jeu plus ancien simulé).
