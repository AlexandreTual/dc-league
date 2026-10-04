# Design — Mode test solo

**Date :** 2026-10-04  
**Statut :** En relecture  
**Sous-projet :** 3/3 de la feuille de route « jeu en ligne » (1. comptes joueurs ✅ → 2. import de decks ✅ → 3. mode test solo → plus tard multijoueur)

---

## Contexte

Les decks ont désormais une liste de cartes complète (`deck_cards`, cache `cards` FR/EN) et une page publique `/decks/[id]` avec un bouton « Tester le deck » marqué « Bientôt ». On veut un mode test à la Moxfield/Archidekt pour manipuler les cartes d'un deck, sans règles automatisées, dont le moteur servira de base au futur jeu en ligne à 4–5 joueurs.

## Objectifs

- Jouer seul avec un deck importé : zones, glisser-déposer, pioche, mulligan, points de vie, tours.
- Fonctions avancées : marqueurs, jetons, gestion de la bibliothèque, taxe de commandant, annuler, journal, statistiques.
- Moteur pur, déterministe et rejouable, réutilisable côté serveur pour le multijoueur.
- Sauvegarde automatique dans le navigateur.
- Interface pensée pour l'ordinateur, sans obstacle à une future adaptation tablette.

## Hors périmètre

- Règles automatisées (pile, phases, combat, mana).
- Multijoueur, adversaires, sauvegarde serveur.
- Optimisation tablette ou téléphone (seule la compatibilité tactile de base est garantie).
- Statistiques sur plusieurs parties.

---

## Décisions

| Sujet | Décision |
|---|---|
| Appareil | Ordinateur d'abord ; glisser-déposer via pointer events (`@dnd-kit/core`) et toutes les actions accessibles par menu (clic droit / appui long), pour une future tablette |
| Fonctions | Base + marqueurs, jetons, bibliothèque (regarder X, chercher, révéler, dessus/dessous), taxe de commandant, annuler, journal, statistiques |
| Sauvegarde | Automatique dans `localStorage`, reprise ou nouvelle partie au retour |
| Moteur | Fonction pure `applyAction`, hasard à graine, partie = liste d'actions rejouable |
| Jetons | Recherche Scryfall depuis le navigateur, ou jeton personnalisé |
| Accès | Page publique, comme `/decks/[id]` ; rien n'est écrit en base |

---

## Moteur — `lib/game/`

### Types (`types.ts`)

```ts
type ZoneId = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command'

type CatalogEntry = { ref: number; en: CardRow; fr: CardRow | null; quantity: number; isCommander: boolean }
type Catalog = { deckId: string; fingerprint: string; entries: CatalogEntry[] }

type TokenData = { name: string; typeLine: string; power: string | null; toughness: string | null; colors: string[]; image: string | null }

type CardInstance = {
  id: string                 // `c${ref}-${n}` pour un exemplaire du deck, `t${n}` pour un jeton
  ref: number | null
  token: TokenData | null
  isCommander: boolean
  tapped: boolean
  flipped: boolean
  faceDown: boolean
  counters: { plus: number; minus: number; other: number }
  x: number                  // 0–100 (% de la largeur du champ de bataille)
  y: number                  // 0–100 (% de la hauteur)
}

type LogEntry = { turn: number; text: string }

type GameState = {
  turn: number
  life: number
  zones: Record<ZoneId, string[]>   // index 0 = dessus de la bibliothèque
  cards: Record<string, CardInstance>
  commanderCasts: Record<string, number>
  stats: { drawn: number; landsPlayed: number; mulligans: number }
  nextTokenId: number
  log: LogEntry[]
}

type Position = 'top' | 'bottom' | number

type GameAction =
  | { type: 'start'; seed: number }
  | { type: 'shuffle'; seed: number }
  | { type: 'draw'; count: number }
  | { type: 'mulligan'; seed: number }
  | { type: 'move'; id: string; to: ZoneId; position?: Position; x?: number; y?: number }
  | { type: 'tap'; id: string }
  | { type: 'untapAll' }
  | { type: 'flip'; id: string }
  | { type: 'faceDown'; id: string }
  | { type: 'counter'; id: string; kind: 'plus' | 'minus' | 'other'; delta: number }
  | { type: 'createToken'; token: TokenData; x: number; y: number }
  | { type: 'life'; delta: number }
  | { type: 'commanderTax'; id: string; delta: number }
  | { type: 'nextTurn' }
  | { type: 'reveal' }        // ajoute « Révèle <carte du dessus> » au journal
```

Constantes : `STARTING_LIFE = 40`, `OPENING_HAND = 7`, `SNAPSHOT_EVERY = 20`, `COMMANDER_TAX_STEP = 2`.

### Hasard (`random.ts`)

- `createRng(seed: number): () => number` : générateur pseudo-aléatoire mulberry32, sortie dans [0, 1).
- `shuffle<T>(items: T[], seed: number): T[]` : Fisher-Yates sur une copie.

### Mise en place (`setup.ts`)

`createInitialState(catalog: Catalog): GameState` : un exemplaire par unité de `quantity`. Les commandants vont en zone `command`, tout le reste en `library` dans l'ordre du catalogue (non mélangé : c'est `start` qui mélange). Points de vie à 40, tour 1, statistiques à zéro, journal vide.

### Application (`apply.ts`)

`applyAction(state: GameState, action: GameAction, catalog: Catalog): GameState` est **pure** : elle ne modifie jamais `state`, et une action impossible renvoie un état équivalent (avec une ligne de journal quand c'est utile).

| Action | Règles |
|---|---|
| `start` | Mélange la bibliothèque avec `seed`, pioche 7 (`stats.drawn += 7`), journal « Début de partie » |
| `shuffle` | Mélange la bibliothèque, journal « Mélange la bibliothèque » |
| `draw` | Pioche `min(count, taille)` cartes ; bibliothèque vide → journal « Bibliothèque vide » |
| `mulligan` | Main → bibliothèque, mélange, pioche 7, `stats.mulligans += 1`. **Premier mulligan gratuit** : cartes à remettre en dessous = `max(0, mulligans − 1)`. Journal « Mulligan n°N (gratuit) » pour le premier, sinon « Mulligan n°N : mets K carte(s) en dessous » |
| `move` | Retire la carte de sa zone et l'insère dans `to` à `position` (`top` par défaut pour la bibliothèque, à la fin pour les autres zones). Champ de bataille : `x`, `y` (par défaut 50/50, bornés à 0–100). En quittant le champ de bataille : `tapped`, `flipped`, `counters` remis à zéro. Un jeton qui va ailleurs que sur le champ de bataille **disparaît** (retiré de `cards`). Commandant de `command` vers une autre zone → `commanderCasts[id] += 1`. Terrain (type de la face avant contenant `Land`) de `hand` vers `battlefield` → `stats.landsPlayed += 1`. Déplacement dans la même zone : réordonne (bibliothèque) ou repositionne (champ de bataille). |
| `tap` | Inverse `tapped` (champ de bataille uniquement) |
| `untapAll` | Dégage tout le champ de bataille |
| `flip` | Inverse `flipped` (cartes à plusieurs faces uniquement) |
| `faceDown` | Inverse `faceDown` (champ de bataille uniquement) |
| `counter` | Ajoute `delta` au compteur, sans descendre sous 0 |
| `createToken` | Crée `t${nextTokenId}` sur le champ de bataille, `nextTokenId += 1` |
| `life` | Ajoute `delta` (peut devenir négatif) |
| `commanderTax` | Ajoute `delta` à `commanderCasts[id]`, sans descendre sous 0 |
| `nextTurn` | `turn += 1`, dégage tout, pioche 1 ; journal « Tour N » |
| `reveal` | Journal « Révèle <nom> » (nom de la carte du dessus), sinon « Bibliothèque vide » |

**Journal** : texte en français, préfixé du tour dans l'affichage. Nom de carte = **nom français** (`printed_name` de la version FR) s'il existe, sinon nom anglais, quelle que soit la langue d'affichage choisie. Une carte vers ou depuis la bibliothèque, ou face cachée, est notée « une carte ». Exemples : « Pioche 2 cartes », « Sol Ring : main → champ de bataille », « une carte : main → bibliothèque (dessous) », « Kenrith : +1/+1 (2) », « Points de vie : 40 → 37 ».

Utilitaires exportés : `taxOf(state, id) = 2 × commanderCasts[id]`, `bottomCount(state) = max(0, stats.mulligans − 1)`, `cardName(state, catalog, id)`, `cardData(state, catalog, id, lang): { name, image, typeLine, faces }`.

### Rejouer et annuler (`replay.ts`)

- `replay(catalog, actions): GameState` = `actions.reduce(applyAction, createInitialState(catalog))`.
- `class GameHistory` : garde `actions` et un état intermédiaire (« snapshot ») toutes les 20 actions. `push(action)`, `undo()` (retire la dernière action et recalcule depuis le dernier snapshot valide), `state`, `actions`. Une action `start` ne peut pas être annulée.

### Sauvegarde (`storage.ts`)

- Clé `dc-playtest-<deckId>`, valeur `{ version: 1, fingerprint, actions }`.
- `fingerprint` = chaîne `ref:quantité:id-EN` de toutes les entrées du catalogue, jointes par `|` (calcul synchrone, comparaison exacte).
- `saveGame(catalog, actions)` et `loadGame(catalog): GameAction[] | null` : `try/catch` partout ; version différente, empreinte différente ou JSON illisible → `null`.
- `clearGame(deckId)`.

### Catalogue (`catalog.ts`)

`buildCatalog(deckId: string, cards: DeckCardView[]): { catalog: Catalog; excluded: string[] }` : une entrée par ligne de deck **trouvée** (`en` non nul), `ref = position`, `isCommander = section === 'commander'` ; les noms des lignes introuvables vont dans `excluded`.

---

## Interface

### Page

`app/decks/[id]/test/page.tsx` (serveur, edge) : `getDeck` (404 si absent), `listDeckCards`, puis `buildCatalog` ; si le catalogue est vide → « Importe d'abord la liste du deck » avec un lien vers `/profil/decks`. Sinon, rendu de `<Playtest>` en pleine largeur (sans le conteneur `max-w-5xl`). Sur `/decks/[id]`, le bouton « Tester le deck » devient un lien actif.

### Composants (`components/playtest/`)

- `Playtest.tsx` : tient `GameHistory`, sauvegarde après chaque action, gère les raccourcis clavier, la langue (`dc-card-lang`) et l'écran de démarrage.
- `Battlefield.tsx` : zone de dépôt ; cartes positionnées en absolu selon `x`/`y` ; carte engagée tournée de 90°.
- `Hand.tsx` : rangée de cartes, qui se chevauchent au-delà de la largeur disponible.
- `ZonePile.tsx` : commandement, bibliothèque (dos de carte + nombre), cimetière, exil (carte du dessus + nombre, clic pour voir toute la pile).
- `GameCard.tsx` : image (`image_small` en main et dans les piles, `image_normal` sur le champ de bataille), face cachée ou face B selon l'état, pastilles de marqueurs, badge de taxe sur un commandant.
- `CardMenu.tsx` : menu contextuel de carte et de bibliothèque.
- `LibraryModal.tsx` : « Regarder les X du dessus » (X demandé) et « Chercher » (toute la bibliothèque, filtre par nom), avec pour chaque carte les boutons Main / Champ / Cimetière / Exil / Dessus / Dessous ; case « Mélanger en fermant », cochée par défaut pour « Chercher », décochée pour « Regarder ».
- `TokenModal.tsx` : onglet Scryfall (`GET https://api.scryfall.com/cards/search?q=t:token <texte>&unique=cards`, vignettes cliquables) et onglet Personnalisé (nom, force/endurance, couleurs).
- `LogPanel.tsx` : journal (du plus récent au plus ancien) et statistiques (tour, cartes piochées, terrains joués, mulligans, taille de la bibliothèque).
- `PreviewPane.tsx` : grande image de la carte survolée, en bas à droite.

### Interactions

- **Glisser-déposer** (`@dnd-kit/core`, `PointerSensor` avec un seuil de 5 px, et `TouchSensor` avec un appui de 200 ms) entre toutes les zones. Champ de bataille : position de dépôt convertie en %. Bibliothèque : dessus, ou dessous si la touche Maj est enfoncée.
- **Double-clic** : carte du champ de bataille → `tap` ; bibliothèque → `draw 1` ; carte en main → `move` vers le champ de bataille.
- **Clic droit** (et appui long au doigt, via l'événement `contextmenu`) : menu de la carte. Engager, retourner (si la carte a plusieurs faces), face cachée, marqueurs (+1/+1 et -1/-1, ±, compteur libre ±), « Envoyer vers » chaque zone, dessus ou dessous de la bibliothèque, et pour un commandant « Taxe ± ».
- **Menu de la bibliothèque** : Piocher 1, Piocher N…, Mélanger, Regarder les X du dessus…, Chercher…, Révéler la carte du dessus.
- **Barre du haut** : Tour N + « Tour suivant », points de vie [−1][+1] (Maj = ±5), FR/EN, Annuler, « + Jeton », Journal, Nouvelle partie (avec confirmation), Retour au deck.
- **Raccourcis** (ignorés pendant la saisie dans un champ) : `D` piocher, `U` tout dégager, `N` tour suivant, `S` mélanger, `M` mulligan, `Ctrl+Z` / `Cmd+Z` annuler, `Échap` fermer la fenêtre ou le menu ouvert.

### Démarrage

- Si `loadGame` renvoie des actions : écran « Reprendre la partie (tour N) » / « Nouvelle partie ».
- Nouvelle partie : `start` avec une graine aléatoire (`crypto.getRandomValues`), puis bandeau « Garder » / « Mulligan » tant qu'aucune autre action que des mulligans n'a été jouée. Après au moins un mulligan, le bandeau rappelle « Mets K carte(s) en dessous de ta bibliothèque » avec K = `bottomCount(state)` = `max(0, mulligans − 1)` (premier mulligan gratuit) ; rien à remettre si K = 0.
- Les cartes exclues (introuvables) sont signalées dans un bandeau refermable.

---

## Gestion des erreurs

- Action impossible → état équivalent, sans exception.
- Catalogue vide → message et lien vers l'import.
- Recherche de jetons en échec (réseau, 404) → « Aucun jeton trouvé » ou « Scryfall ne répond pas » ; l'onglet Personnalisé reste disponible.
- `localStorage` indisponible → la partie continue sans sauvegarde.

## Tests

- `random.ts` : même graine → même ordre ; graines différentes → ordres différents ; permutation sans perte ni doublon.
- `setup.ts` : 30 Forêts → 30 exemplaires d'identifiants distincts ; commandant en `command` ; aucune carte en main avant `start`.
- `apply.ts` : un bloc par action (cas de la spec ci-dessus), plus : premier mulligan gratuit (`bottomCount` 0 puis 1) ; nom français dans le journal avec repli anglais ; immuabilité de l'état d'entrée ; `start` donne 7 cartes en main et bibliothèque = total − commandants − 7 ; mulligan ; dessus et dessous de bibliothèque ; jeton qui disparaît ; taxe à l'aller seulement ; terrain joué compté ; remise à zéro en quittant le champ de bataille ; `nextTurn` ; compteurs bornés à 0 ; journal (y compris l'anonymat des cartes cachées).
- `replay.ts` : rejouer donne un état égal ; `undo` équivaut à rejouer sans la dernière action ; égalité avec et sans snapshot (plus de 45 actions) ; `start` non annulable.
- `storage.ts` (`localStorage` simulé) : aller-retour, empreinte différente → `null`, JSON illisible → `null`, accès qui lève une exception → `null` sans erreur.
- `catalog.ts` : exclusion des introuvables, commandants, quantités.
- **Interface** : vérification dans Chromium (Playwright) sur `wrangler pages dev` avec un cache local rempli à la main. Parcours : démarrage, main de 7, glisser une carte de la main vers le champ de bataille, engager, menu contextuel, mulligan, tour suivant, annuler, jeton personnalisé, rechargement et reprise. Captures d'écran remises à l'utilisateur.

## Dépendances

- `@dnd-kit/core` (dépendance de production).
- `playwright-core` en dépendance de développement **uniquement si nécessaire** pour la vérification (le navigateur Chromium est déjà installé dans l'environnement de développement).
