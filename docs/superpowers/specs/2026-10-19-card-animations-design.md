# Animations et capacités des cartes en jeu — conception

Date : 2026-10-19
Statut : validée (liseré et éclat d'arrivée, flottement, capacités données affichées en symboles ou libellés au choix dans les réglages)
Maquette : https://claude.ai/artifact/AvkfDG78QDPF448bsiXiwn

## But

Rendre la table plus vivante et plus lisible, sans gêner la lecture :

- un **liseré doré** et un **éclat à l'arrivée en jeu** sur les **permanents légendaires** ;
- une **lévitation** des **créatures avec le vol** ;
- **donner (ou retirer) une capacité** à une carte en jeu, à la main, avec un symbole ou un libellé sur la carte.

Ces effets s'appliquent sur les champs de bataille (le mien, ceux des adversaires, la fenêtre à part), en mode test comme en ligne.
Hors champ de bataille (main, piles, aperçu, deck) : aucune animation, aucun symbole.

## Effet légendaire : liseré et éclat d'arrivée (retenu)

Une carte est légendaire si la ligne de type de sa face visible contient `Legendary`. C'est le recto, ou la face affichée d'une
carte transformée, lue dans la version anglaise du catalogue, comme dans `lib/game/battlefield.ts`. Pour un jeton, on lit son
`typeLine`.

Effet : un liseré doré fin, permanent. À l'**arrivée en jeu**, un éclat traverse la carte en diagonale **une seule fois**
(1,1 s), comme un reflet de miroir, puis il reste le liseré seul. Un reflet qui revenait toutes les 7 s a été essayé puis
écarté : il déconcentrait (décision du 19 octobre).

- « Arrivée en jeu » : carte visible absente de tous les champs de bataille dans la vue précédente
  (`enteredBattlefield`, `lib/game/card-effects.ts`). Elle se voit chez tous les joueurs, y compris pour la carte d'un
  adversaire.
- Pas d'éclat au premier affichage : chargement de la page, partie reprise, fenêtre à part, reconnexion.
- Pas d'éclat non plus quand la carte est engagée, déplacée sur le champ de bataille ou change de disposition (bandeau ou
  plateau). Une carte qui quitte le champ de bataille puis y revient a un nouvel éclat.
- Une carte légendaire engagée garde son liseré.

## Vol : flottement (retenu)

Une créature vole si elle a le vol **imprimé** et ne l'a pas perdu, ou si on le lui a **donné** (voir « Capacités données »).

- **Vol imprimé** : mot-clé `Flying` dans les capacités de la face visible, fournies par Scryfall (champ `keywords`).
  - Scryfall donne une seule liste pour toute la carte, faces comprises, et y met aussi les mots-clés seulement cités
    (« Creatures you control have flying »). Une carte recto-verso dont seul le verso vole (Delver of Secrets) volerait
    donc dès le recto.
  - On garde un mot-clé de cette liste seulement s'il est écrit sur une **ligne de mots-clés** du texte de la face
    (« Flying, vigilance », « Flying (rappel…) », « Ward {2} »), jamais dans une phrase (`lib/cards/keywords.ts`). Le
    calcul est fait à l'import, face par face.
- **Animation** : la carte flotte doucement (quelques pixels, ~3 s par aller-retour) au-dessus d'une ombre qui rétrécit quand
  elle monte. Chaque carte a son propre décalage, pour que les créatures ne flottent pas toutes en même temps.
- **Créature engagée** : elle se pose (pas de lévitation, ombre fixe).
- **Jetons** : `TokenData` reçoit `keywords?: string[]`, facultatif (absent s'il n'en a pas). Il est rempli depuis Scryfall
  pour les jetons du deck et ceux de la recherche, et repris de la face montrée pour un jeton copie. Un jeton créé à la
  main n'a pas de capacité imprimée, mais on pourra lui en donner une (étape 3).
  - Les jetons d'un deck importé avant la migration n'ont pas leurs capacités : elles arrivent au prochain import du deck
    (« Réimporter »).
  - Avec un serveur de jeu plus ancien, le champ est retiré à la validation : le jeton est créé sans flotter.

### Données

- Migration `0018_card_keywords.sql` : colonne `keywords` (JSON ; `NULL` = pas encore lues ; `[]` = aucune) dans `cards`
  et dans `deck_tokens`. `keywords` est aussi ajouté à chaque face du JSON `faces`.
- `toCardRow` calcule `keywords` (celles du recto) et celles de chaque face. `CardRow.keywords?: string[]` est absent pour
  une carte enregistrée avant la migration.
- Site déployé avant la migration : cartes et jetons sont enregistrés sans la colonne (comme pour la migration 0014).
- Les cartes existantes sont rattrapées comme pour la force/endurance (`lib/cards/stats.ts`) : relues chez Scryfall à
  l'ouverture du deck en mode test ou au lancement d'une partie, une fois par carte. Pas de réimport nécessaire.

## Capacités données

Une seule entrée dans le menu d'une carte en jeu : **« Donner une capacité… »**. Elle ouvre une modale « Capacités : <nom> »
qui liste les capacités, chacune avec une case à cocher et son icône :

- les capacités que la carte a déjà sont cochées. Une capacité imprimée est marquée « (imprimée) », une capacité donnée pour
  le tour est marquée « (ce tour) » ;
- **cocher** une capacité non imprimée la donne ; **décocher** une capacité donnée la retire ;
- **décocher** une capacité imprimée la marque **perdue** ; la recocher l'annule ;
- un choix **« Durée des capacités ajoutées »** s'applique aux capacités ajoutées par cette validation :
  - **« Tout le temps »** (par défaut) : la capacité reste jusqu'à ce qu'on la retire, ou que la carte quitte le champ de
    bataille ;
  - **« Jusqu'à la fin du tour »** : la capacité est retirée automatiquement au passage du tour (`endTurn`) ;
- « Valider » envoie tous les changements en une seule action, qui donne une seule ligne de journal. Exemple : « Ana donne
  piétinement et célérité à Elfes de Llanowar (jusqu'à la fin du tour) », ou « Ana retire le vol à Ange de Serra ».

Liste de départ (nom français officiel, nom Scryfall, icône Lucide), qu'on pourra allonger sans toucher au menu :

| Capacité | Scryfall | Icône |
|---|---|---|
| Vol | Flying | Feather |
| Contact mortel | Deathtouch | Skull |
| Lien de vie | Lifelink | HeartPulse |
| Piétinement | Trample | Footprints |
| Vigilance | Vigilance | Eye |
| Célérité | Haste | Zap |
| Initiative | First strike | Sword |
| Double initiative | Double strike | Swords |
| Défense talismanique | Hexproof | ShieldCheck |
| Linceul | Shroud | EyeOff |
| Indestructible | Indestructible | Anvil |
| Menace | Menace | Users |
| Portée | Reach | ArrowUpToLine |
| Défenseur | Defender | BrickWall |
| Infection | Infect | Biohazard |

Les capacités qui prennent un paramètre (protection contre une couleur, gardien {coût}…) sont hors champ : on pourra les ajouter
plus tard avec une saisie libre.

### Affichage sur la carte

- Le **vol** donné n'a pas de symbole, puisqu'il a déjà son animation : la carte se met à flotter.
- Les **autres capacités données** ont un badge doré, dans le style choisi par chaque joueur dans les réglages de la table :
  - **Symboles** (façon Moxfield, par défaut) : petites pastilles rondes avec l'icône, en colonne sur le bord gauche de la
    carte ;
  - **Libellés** : petits libellés « ICÔNE NOM » au milieu de la carte.
- Une capacité **jusqu'à la fin du tour** a un bord en pointillés.
- Une capacité imprimée **perdue** a un badge rouge barré. Un vol perdu arrête aussi la lévitation.
- Les capacités imprimées ne sont pas répétées sur la carte : elles se lisent déjà sur l'image.
- L'aperçu de la carte (survol, appui long) liste en toutes lettres les capacités données et perdues. C'est utile sur
  tablette, où les symboles sont petits.
- Les badges restent visibles même si la case « Animations des cartes » est décochée, car c'est une information de jeu, pas
  une décoration.

### Moteur de partie

- `CardInstance` reçoit deux champs facultatifs, comme `ptMod` :
  - `gained?: { keyword: Keyword; untilEndOfTurn?: true }[]` ;
  - `lost?: Keyword[]`.
  Ils sont absents s'ils sont vides, et toujours absents hors du champ de bataille : ils sont effacés quand la carte quitte le
  champ de bataille.
- Nouvelle action `{ type: 'abilities'; actor; id; gained: Keyword[]; lost: Keyword[]; untilEndOfTurn?: boolean }`. Elle
  décrit l'état voulu, pas un écart. Ses droits sont ceux de la force/endurance (`rules.ts`) : la carte doit être sur le champ
  de bataille et connue.
- `Keyword` est la liste fermée ci-dessus. `validate.ts` refuse tout autre mot.
- `endTurn` retire les capacités `untilEndOfTurn` de tous les permanents.
- `VisibleCard` reçoit `gained?` et `lost?`. Une carte face cachée garde ses capacités données, car elles concernent le
  permanent, pas l'identité de la carte. Aucune information cachée n'est révélée.

## Réglage et accessibilité

- Nouvelle case dans les réglages de la table : **« Animations des cartes »**. Elle est cochée par défaut et mémorisée sur
  l'appareil (`TableSettings.cardEffects` ; absente d'une ancienne sauvegarde = cochée). Elle coupe le liseré, l'éclat et le
  flottement, pas les badges.
- Nouveau choix dans les réglages de la table : **« Capacités sur les cartes : Symboles / Libellés »**. « Symboles » est le
  choix par défaut. Il est mémorisé sur l'appareil (`TableSettings.abilityStyle: 'icons' | 'labels'` ; absent ou illisible
  = `'icons'`). C'est un choix d'affichage propre à chaque joueur, sans effet sur la partie.
- `prefers-reduced-motion: reduce` : liseré doré seul pour les légendaires ; créature volante légèrement surélevée au-dessus
  de son ombre, immobile.
- Pendant un glisser, la carte déplacée n'est pas animée.

## Performances (tablette)

- Uniquement du CSS, avec des animations limitées à `transform` et `opacity` (pas de `box-shadow` ni de `filter` animés).
- Aucune minuterie JavaScript.
- À vérifier avec 30 cartes animées sur la tablette (1180×820).

## Compatibilité

- **Serveur de jeu plus ancien** :
  - `keywords`, `gained` et `lost` sont absents : pas de vol ni de badge, rien ne plante ;
  - l'action `abilities` est refusée avec une erreur propre en français. Elle ne marche donc en ligne qu'après la fusion,
    quand le Worker est redéployé ; en mode test, elle marche tout de suite ;
  - l'effet légendaire ne dépend que de la ligne de type, déjà présente.
- **Site déployé avant la migration** (une à deux minutes) : la lecture de `keywords` tolère une colonne absente, comme pour
  la migration 0012.

## Découpage

1. Liseré et éclat d'arrivée des légendaires, case « Animations des cartes » et mouvement réduit (sans migration).
2. Vol imprimé : migration, import et rattrapage des mots-clés, jetons, flottement.
3. Capacités données : action `abilities`, modale (avec la durée), badges, réglage symboles/libellés, journal, fin du tour,
   aperçu.

## Vérifications

- **Vitest** :
  - détection légendaire : recto, face transformée, jeton, carte cachée ;
  - détection du vol : imprimé, absent, face, donné, perdu ;
  - lecture des réglages, y compris une ancienne sauvegarde ;
  - rattrapage des mots-clés ;
  - action `abilities` : droits, validation, journal, retrait au passage du tour, effacement en quittant le champ de bataille,
    `viewFor`.
- **Navigateur** :
  - nouveau script `scripts/card-effects-check.mjs` : mode test, en ligne, tablette, réglage décoché, mouvement réduit,
    modale des capacités ;
  - `playtest-check` et `online-check` toujours verts.
