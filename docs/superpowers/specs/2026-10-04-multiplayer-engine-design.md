# Design — Moteur multijoueur

**Date :** 2026-10-04  
**Statut :** Validé, implémenté  
**Projet :** multijoueur en ligne, sous-projet 1/4 (1. moteur → 2. serveur temps réel et salon → 3. interface de table → 4. matchs de ligue en ligne)

---

## Contexte

Le mode test solo repose sur un moteur pur (`lib/game/`) : état, actions déterministes, hasard à graine, rejeu et annulation. Pour jouer en ligne à 2–5 joueurs (parties libres en Commander, et matchs de ligue en Duel Commander), il faut un moteur qui gère plusieurs joueurs, la propriété et le contrôle des cartes, les compteurs de joueur et, surtout, **ce que chaque joueur a le droit de voir**.

## Objectifs

- Un **seul moteur** pour N joueurs (1 à 5) ; le mode test devient une partie à un joueur.
- Propriétaire / contrôleur, avec les droits définis plus bas (réanimation depuis le cimetière d'un adversaire, vol, don de contrôle).
- Compteurs de joueur : points de vie, blessures de commandant, poison, monarque, initiative, compteurs libres, ordre du tour, élimination.
- Informations cachées : révéler, regarder ou chercher dans la bibliothèque d'un adversaire, exil face cachée, carte du dessus révélée, joueur éliminé qui voit tout (option).
- `viewFor(état, joueur)` : la vue envoyée à un joueur ne contient **aucune** information qu'il n'a pas le droit de voir.
- Migration du mode test sur ce moteur, sans régression.

## Hors périmètre

Réseau, serveur et salon (sous-projet 2) ; interface de table multijoueur (sous-projet 3) ; matchs de ligue (sous-projet 4) ; règles automatisées de Magic (pile, combat, mana).

---

## Modèle

### Mise en place

```ts
type Format = 'commander' | 'duel'
type GameSetup = {
  format: Format
  players: { id: string; name: string; catalog: Catalog }[]   // 1 à 5
  options: { eliminatedSeeAll: boolean }
}
```

| Constante | `commander` | `duel` |
|---|---|---|
| Points de vie de départ | 40 | 20 |
| Blessures de commandant | suivies, alerte à 21 | **non utilisées** (action refusée, compteur absent de l'interface) |
| Poison mortel (alerte) | 10 | 10 |
| Pioche du premier joueur à son premier tour | selon le nombre de joueurs (règle 103.8) : oui à partir de 3 joueurs, non à 1 ou 2 | idem (donc non en 1 contre 1) |

`OPENING_HAND = 7`, `SNAPSHOT_EVERY = 20`, `COMMANDER_TAX_STEP = 2`.

### État

```ts
type PlayerZone = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'command'
type ZoneRef = { player: string; zone: PlayerZone }

type PlayerState = {
  id: string; name: string
  life: number; poison: number
  counters: Record<string, number>            // compteurs libres nommés (énergie…)
  commanderDamage: Record<string, number>     // id de la carte commandant → blessures reçues
  eliminated: boolean
  kept: boolean                               // main gardée
  mulligans: number
  topRevealed: boolean
  zones: Record<PlayerZone, string[]>         // battlefield = cartes que ce joueur contrôle
  stats: { drawn: number; landsPlayed: number }
}

type CardInstance = {
  id: string                    // `${playerId}:c${ref}-${n}` ; jeton `t${n}`
  owner: string
  ref: number | null            // position dans le catalogue du propriétaire
  token: TokenData | null
  isCommander: boolean
  tapped: boolean; flipped: boolean; faceDown: boolean
  counters: { plus: number; minus: number; other: number }
  x: number; y: number          // position sur le champ de bataille de son contrôleur, en %
  knownBy: string[]             // joueurs qui voient la carte en plus de la règle de sa zone
}

type LogEntry = { turn: number; actor: string | null; text: string; visibleTo: string[] | 'all' }

type GameState = {
  format: Format
  options: GameSetup['options']
  players: Record<string, PlayerState>
  turnOrder: string[]           // ordre tiré au sort au départ
  activePlayer: string
  turn: number                  // tour de table (augmente quand on revient au premier joueur)
  firstTurnDone: boolean
  monarch: string | null
  initiative: string | null
  cards: Record<string, CardInstance>
  commanderCasts: Record<string, number>
  lookingAt: Record<string, string[]>   // id de l'auteur → bibliothèques (ids de joueur) qu'il regarde
  nextTokenId: number
  log: LogEntry[]
}
```

Le contrôleur d'une carte est le joueur dont le `battlefield` la contient ; hors du champ de bataille, c'est son propriétaire.

### Visibilité

Une carte est **visible** pour le joueur `p` si :

1. `p` est éliminé et `options.eliminatedSeeAll` est vrai ; ou
2. `p` figure dans `knownBy` ; ou
3. selon sa zone :
   - `library` : seulement la carte du dessus quand `topRevealed` est vrai pour son propriétaire ;
   - `hand` : `p` est le propriétaire ;
   - `battlefield`, `graveyard`, `exile`, `command` : toujours, **sauf** si la carte est `faceDown`.

`knownBy` est vidé quand la carte change de zone, avec une exception : `move` avec `faceDown: true` vers l'exil y place l'auteur.

---

## Actions

Chaque action porte `actor: string` (ou `'server'` pour `start`). Le hasard est fourni dans l'action (`seed`), généré par le serveur.

```ts
type GameAction =
  | { type: 'start'; actor: 'server'; seed: number }
  | { type: 'mulligan'; actor: string; seed: number }
  | { type: 'keep'; actor: string }
  | { type: 'draw'; actor: string; count: number }
  | { type: 'shuffle'; actor: string; seed: number }
  | { type: 'endTurn'; actor: string }
  | { type: 'move'; actor: string; id: string; to: ZoneRef; position?: 'top' | 'bottom' | number; x?: number; y?: number; faceDown?: boolean }
  | { type: 'giveControl'; actor: string; id: string; to: string }
  | { type: 'tap'; actor: string; id: string }
  | { type: 'untapAll'; actor: string }
  | { type: 'flip'; actor: string; id: string }
  | { type: 'faceDown'; actor: string; id: string }
  | { type: 'counter'; actor: string; id: string; kind: 'plus' | 'minus' | 'other'; delta: number }
  | { type: 'createToken'; actor: string; token: TokenData; x: number; y: number }
  | { type: 'life'; actor: string; target: string; delta: number }
  | { type: 'poison'; actor: string; target: string; delta: number }
  | { type: 'playerCounter'; actor: string; target: string; name: string; delta: number }
  | { type: 'commanderDamage'; actor: string; target: string; commander: string; delta: number }
  | { type: 'commanderTax'; actor: string; id: string; delta: number }
  | { type: 'setMonarch'; actor: string; to: string | null }
  | { type: 'setInitiative'; actor: string; to: string | null }
  | { type: 'eliminate'; actor: string; target: string }
  | { type: 'reveal'; actor: string; ids: string[] | 'hand'; to: 'all' | string[] }
  | { type: 'revealTop'; actor: string }
  | { type: 'toggleTopRevealed'; actor: string }
  | { type: 'look'; actor: string; target: string; count: number }
  | { type: 'search'; actor: string; target: string }
  | { type: 'endLook'; actor: string; target: string; shuffle: boolean; seed?: number }
```

### Droits — `canApply(state, action): string | null`

Renvoie `null` si l'action est permise, sinon un message en français. Règles générales : l'auteur doit être un joueur de la partie, non éliminé (sauf `eliminate` sur soi-même) ; les identifiants doivent exister.

| Action | Condition |
|---|---|
| `start` | `actor === 'server'`, une seule fois |
| `mulligan`, `keep` | soi-même, main pas encore gardée |
| `draw`, `shuffle`, `untapAll`, `toggleTopRevealed`, `revealTop`, `createToken` | portent sur ses propres zones |
| `endTurn` | `actor === activePlayer` |
| `move` | **Depuis une zone cachée** (bibliothèque, main) : l'auteur est le propriétaire, **ou** la carte est visible pour lui grâce à `look`/`search` (bibliothèque). **Depuis une zone publique** : n'importe qui. **Destination** : soit le **champ de bataille de l'auteur**, soit une zone **du propriétaire** de la carte (ou du contrôleur si on reste sur le même champ de bataille). Le propriétaire peut aussi déplacer ses cartes n'importe où chez lui. |
| `giveControl` | l'auteur contrôle la carte ; la carte est sur un champ de bataille ; `to` est un joueur de la partie |
| `tap`, `counter` | carte sur un champ de bataille (n'importe qui) |
| `flip`, `faceDown` | l'auteur contrôle la carte |
| `life`, `poison`, `playerCounter`, `setMonarch`, `setInitiative` | n'importe qui, cible = joueur de la partie |
| `commanderDamage` | format `commander` uniquement (en `duel` : « Pas de blessures de commandant en Duel Commander ») ; n'importe qui ; `commander` = une carte commandant d'un autre joueur que la cible |
| `commanderTax` | propriétaire du commandant |
| `eliminate` | n'importe qui (la confirmation est gérée par l'interface) |
| `reveal` | l'auteur est le propriétaire des cartes, qui sont dans sa main (ou `'hand'`) |
| `look`, `search` | n'importe qui, cible = joueur de la partie (y compris soi-même) |
| `endLook` | l'auteur regarde actuellement cette bibliothèque (`lookingAt`) |

### Effets — `applyAction(state, action): GameState`

Pure, ne modifie jamais `state`. Si `canApply` renvoie une erreur, l'état est renvoyé **inchangé**.

- `start` : chaque bibliothèque est mélangée avec une graine dérivée (`seed + index du joueur`) ; chacun pioche 7 ; `turnOrder` = joueurs mélangés avec `seed` ; `activePlayer = turnOrder[0]` ; journal « Début de partie : <nom> commence ».
- `mulligan` / `keep` : comme en solo, par joueur (premier mulligan gratuit : à remettre en dessous = `max(0, mulligans − 1)`).
- `endTurn` : joueur suivant non éliminé dans `turnOrder` ; s'il revient au premier joueur, `turn += 1`. Le nouveau joueur actif dégage tous les permanents qu'il contrôle et pioche 1. Le premier tour du premier joueur commence au `start`, sans pioche ; à partir de 3 joueurs, il pioche 1 carte au moment où il garde sa main (`keep`), après ses mulligans (`firstTurnDone` évite une seconde pioche). Journal « Tour N : <nom> ».
- `move` : comme en solo (remise à zéro en quittant un champ de bataille, jeton qui disparaît hors champ de bataille, taxe à la sortie de la zone de commandement, terrain joué depuis la main). `knownBy` vidé, puis `[actor]` si `faceDown: true` (l'exilant voit la carte). Une carte prise sur la bibliothèque d'un autre est retirée de ce que l'auteur regarde.
- `giveControl` : retire la carte du champ de bataille actuel et l'ajoute à celui de `to`, en conservant son état.
- `commanderDamage` : `players[target].commanderDamage[commander] += delta` (borné à 0) **et** `life -= delta`.
- `life`, `poison`, `playerCounter`, `counter`, `commanderTax` : bornes à 0, sauf la vie qui peut être négative.
- `setMonarch`, `setInitiative` : un seul détenteur à la fois.
- `eliminate` : `eliminated = true` ; si c'était le joueur actif, le tour passe au suivant (sans pioche supplémentaire pour l'éliminé). Ses cartes restent en place.
- `reveal` : ajoute les destinataires à `knownBy` des cartes visées.
- `revealTop` : journal « <nom> révèle <carte> » (visible par tous).
- `look` : ajoute l'auteur à `knownBy` des `count` premières cartes de la bibliothèque cible ; `lookingAt[actor]` inclut `target`.
- `search` : idem sur toute la bibliothèque cible.
- `endLook` : retire l'auteur de `knownBy` de toutes les cartes de cette bibliothèque, retire `target` de `lookingAt[actor]`, mélange si `shuffle` (avec `seed`).

### Journal

- Chaque ligne : `{ turn, actor, text, visibleTo }`, texte préfixé par le nom de l'auteur à l'affichage.
- Noms de carte en français (repli anglais), comme en solo. Une carte cachée pour au moins un joueur est notée « une carte » dans la ligne `visibleTo: 'all'`. Si l'auteur la voit, une seconde ligne, visible par lui seul, donne le détail (par exemple « Tu as vu : Anneau solaire, Forêt, Contresort »).
- `look`/`search` : ligne publique « Bob regarde les 3 cartes du dessus de la bibliothèque d'Alex » / « Bob fouille la bibliothèque d'Alex ».

---

## Vue — `viewFor(state, playerId): PlayerView`

```ts
type CardView =
  | { hidden: true }                                  // aucune autre information
  | { hidden: false; id: string; owner: string; ref: number | null; token: TokenData | null; isCommander: boolean;
      tapped: boolean; flipped: boolean; faceDown: boolean; counters: CardInstance['counters']; x: number; y: number }

type PlayerView = {
  me: string
  format: Format
  turn: number; activePlayer: string; turnOrder: string[]
  monarch: string | null; initiative: string | null
  players: Record<string, Omit<PlayerState, 'zones'> & {
    zones: Record<Exclude<PlayerZone, 'library'>, CardView[]> & { library: { count: number; visible: { index: number; card: CardView }[] } }
  }>
  commanderCasts: Record<string, number>
  lookingAt: string[]                                  // bibliothèques que je regarde
  log: Omit<LogEntry, 'visibleTo'>[]
  canUndo: boolean                                     // renseigné par le serveur / GameHistory
}
```

- Une carte invisible pour `playerId` devient `{ hidden: true }` : **ni identifiant, ni référence, ni propriétaire**.
- Bibliothèques : uniquement le nombre de cartes, plus les cartes visibles (avec leur position).
- Journal : seulement les lignes `visibleTo === 'all'` ou qui contiennent `playerId`.
- `commanderCasts` n'expose que des commandants (cartes publiques).

---

## Rejeu, annulation, sauvegarde

- `replay(setup, actions)` : `actions.reduce(applyAction, createInitialState(setup))`.
- `GameHistory(setup, actions?)` : `push(action)` (refusée si `canApply` échoue, renvoie l'erreur), `state`, `actions`, `canUndo(actor)` (vrai si la dernière action est de `actor` et n'est pas `start`), `undo(actor)`. Un snapshot toutes les 20 actions.
- `storage.ts` (mode test) : format `{ version: 2, fingerprint, actions }` ; une sauvegarde de version 1 est ignorée.

## Migration du mode test

- La page `/decks/[id]/test` crée un `GameSetup` à un joueur (`id: 'solo'`, format `commander`, `eliminatedSeeAll: false`) et un `start` avec une graine du navigateur.
- Les composants de `components/playtest/` affichent `viewFor(state, 'solo')` et envoient des actions avec `actor: 'solo'`. Le comportement visible reste identique : mêmes zones, mêmes menus, mêmes raccourcis.
- `nextTurn` devient `endTurn` (en solo : tour suivant, dégagement, pioche).
- `scripts/playtest-check.mjs` doit passer **sans modifier ses attentes** (seuls des sélecteurs peuvent être adaptés si la structure HTML change).

## Fichiers

`lib/game/` : `types.ts`, `setup.ts`, `rules.ts` (droits), `apply.ts` (effets et journal), `view.ts`, `replay.ts`, `storage.ts` ; inchangés : `random.ts`, `tokens.ts`, `keyboard.ts`, `catalog.ts`.

## Tests

- Reprise des tests solo existants, adaptés (partie à un joueur).
- **Multijoueur** (`rules.test.ts`, `apply.multi.test.ts`) : réanimer depuis le cimetière d'un adversaire ; voler une créature puis la voir retourner au cimetière de son propriétaire ; refus de prendre dans la main ou la bibliothèque d'un autre ; `giveControl` ; ordre du tour avec élimination ; pas de pioche au premier tour en duel ; `commanderDamage` (par commandant, vie retirée) ; monarque et initiative ; `endTurn` refusé hors joueur actif ; `commanderDamage` refusé en duel ; `canUndo` faux si un autre joueur a joué depuis.
- **Visibilité** (`view.test.ts`) : main propre visible et mains adverses cachées ; carte cachée sans identifiant ni référence ; `reveal` à un joueur puis changement de zone → de nouveau cachée ; `look` puis `endLook` ; `search` puis prise d'une carte ; exil face cachée visible par l'exilant seulement ; `topRevealed` ; joueur éliminé avec et sans l'option ; journal filtré (le détail de `look` n'apparaît que pour l'auteur).
- **Anti-fuite** : 200 actions aléatoires valides (graine fixe) sur une partie à 4 joueurs ; pour chaque joueur, aucun identifiant de carte cachée pour lui n'apparaît dans `JSON.stringify(viewFor(...))`.
- **Mode test** : `scripts/playtest-check.mjs` au vert après migration.
