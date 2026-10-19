# Animations et capacités des cartes en jeu — conception

Date : 2026-10-19
Statut : effets choisis (reflet, flottement) ; affichage des capacités données à choisir (symboles ou libellés)
Maquette : https://claude.ai/artifact/AvkfDG78QDPF448bsiXiwn

## But

Rendre la table plus vivante et plus lisible, sans gêner la lecture :

- un **reflet** sur les **permanents légendaires** ;
- une **lévitation** des **créatures avec le vol** ;
- **donner (ou retirer) une capacité** à une carte en jeu, à la main, avec un symbole ou un libellé sur la carte.

Ces effets s'appliquent sur les champs de bataille (le mien, ceux des adversaires, la fenêtre à part), en mode test comme en ligne.
Hors champ de bataille (main, piles, aperçu, deck) : aucune animation, aucun symbole.

## Effet légendaire : reflet (retenu)

Une carte est légendaire si la ligne de type de sa face visible contient `Legendary`. C'est le recto, ou la face affichée d'une
carte transformée, lue dans la version anglaise du catalogue, comme dans `lib/game/battlefield.ts`. Pour un jeton, on lit son
`typeLine`.

Effet : un liseré doré fin, et un reflet lumineux qui traverse la carte en diagonale toutes les ~7 s. Chaque carte a son propre
décalage, tiré de son identifiant, pour que les légendaires ne brillent pas toutes en même temps. Une carte légendaire engagée
garde son effet.

## Vol : flottement (retenu)

Une créature vole si elle a le vol **imprimé** et ne l'a pas perdu, ou si on le lui a **donné** (voir « Capacités données »).

- **Vol imprimé** : mot-clé `Flying` dans les capacités de la face visible, fournies par Scryfall (champ `keywords`). On ne
  cherche pas dans le texte de la carte : « ne peut être bloquée que par des créatures avec le vol » donnerait de faux positifs.
- **Animation** : la carte flotte doucement (quelques pixels, ~3 s par aller-retour) au-dessus d'une ombre qui rétrécit quand
  elle monte. Chaque carte a son propre décalage, comme pour le reflet.
- **Créature engagée** : elle se pose (pas de lévitation, ombre fixe).
- **Jetons** : `TokenData` reçoit `keywords?: string[]`, facultatif, rempli depuis Scryfall pour les jetons du deck. Un jeton
  créé à la main n'a pas de capacité imprimée, mais on peut lui en donner une.

### Données

- Migration `0018_card_keywords.sql` : `ALTER TABLE cards ADD COLUMN keywords TEXT;` (JSON ; `NULL` = pas encore lu).
  `keywords` est aussi ajouté à chaque face du JSON `faces`.
- `toCardRow` garde `keywords`. `CardRow.keywords?: string[] | null` est absent pour une carte enregistrée avant la migration,
  ou dans le catalogue d'un serveur de jeu plus ancien.
- Les cartes existantes sont rattrapées comme pour la force/endurance (`lib/cards/stats.ts`) : relues chez Scryfall à
  l'ouverture du deck en mode test ou au lancement d'une partie, une fois par carte. Pas de réimport nécessaire.

## Capacités données

Une seule entrée dans le menu d'une carte en jeu : **« Donner une capacité… »**. Elle ouvre une modale « Capacités : <nom> »
qui liste les capacités, chacune avec une case à cocher et son icône :

- les capacités que la carte a déjà sont cochées. Une capacité imprimée est marquée « (imprimée) », une capacité donnée pour
  le tour est marquée « (ce tour) » ;
- **cocher** une capacité non imprimée la donne ; **décocher** une capacité donnée la retire ;
- **décocher** une capacité imprimée la marque **perdue** ; la recocher l'annule ;
- une case **« Jusqu'à la fin du tour »** s'applique aux capacités ajoutées par cette validation. Ces capacités sont retirées
  automatiquement au passage du tour (`endTurn`) ;
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
- Les **autres capacités données** ont un badge doré. Deux styles possibles, à choisir sur la maquette :
  - **Symboles** (façon Moxfield) : petites pastilles rondes avec l'icône, en colonne sur le bord gauche de la carte ;
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
  l'appareil (`TableSettings.cardEffects` ; absente d'une ancienne sauvegarde = cochée). Elle coupe le reflet et le
  flottement, pas les badges.
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

1. Reflet des légendaires, case « Animations des cartes » et mouvement réduit (sans migration).
2. Vol imprimé : migration, import et rattrapage des mots-clés, jetons, flottement.
3. Capacités données : action `abilities`, modale, badges, journal, fin du tour, aperçu.

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
