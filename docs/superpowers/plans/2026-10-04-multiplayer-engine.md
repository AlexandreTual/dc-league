# Moteur multijoueur — Plan d'implémentation

> **Pour l'implémenteur :** exécuter les tâches dans l'ordre, en TDD (test qui échoue → code minimal → test qui passe → commit). Cases à cocher `- [ ]`.

**Objectif :** remplacer le moteur solo par un moteur pur pour 1 à 5 joueurs (propriété et contrôle, compteurs de joueur, informations cachées, vue filtrée par joueur), puis faire tourner le mode test dessus sans régression.

**Architecture :** le nouveau moteur est construit **à côté** de l'ancien, dans `lib/game/mp/`, pour que le mode test continue de fonctionner pendant les tâches 1 à 6. La tâche 7 le met à la place de l'ancien (`lib/game/`), supprime l'ancien moteur et migre l'interface du mode test sur `viewFor`. La tâche 8 vérifie dans le navigateur.

**Stack :** TypeScript strict, Vitest ; Next.js / React pour la migration ; `playwright-core` + Chromium pour la vérification.

**Spec :** `docs/superpowers/specs/2026-10-04-multiplayer-engine-design.md`

## Contraintes globales

- Formats : `commander` → 40 PV, blessures de commandant suivies (alerte à 21), le premier joueur pioche à son premier tour ; `duel` → 20 PV, **pas** de blessures de commandant (`commanderDamage` refusé : « Pas de blessures de commandant en Duel Commander »), le premier joueur ne pioche pas à son premier tour.
- Poison : alerte à 10. `OPENING_HAND = 7`, `SNAPSHOT_EVERY = 20`, `COMMANDER_TAX_STEP = 2`. Premier mulligan gratuit : `max(0, mulligans − 1)`.
- Identifiants : exemplaire `${playerId}:c${ref}-${n}` (n à partir de 1), jeton `t${n}`.
- Graines : bibliothèque du joueur d'index `i` mélangée avec `seed + i` ; `turnOrder = shuffle(playerIds, seed)`.
- `applyAction` est pure ; si `canApply` renvoie une erreur, l'état est renvoyé **inchangé** (même référence).
- `knownBy` est vidé à chaque changement de zone ; `move` avec `faceDown: true` le remplace par `[actor]`.
- Carte invisible dans une vue : exactement `{ hidden: true }`.
- Journal : noms de carte en français (`printed_name` FR, repli anglais) ; « une carte » dès que la carte est cachée pour au moins un joueur.
- Mode test : `GameSetup` à un joueur `{ id: 'solo', name: 'Moi' }`, format `commander`, `eliminatedSeeAll: false`. Sauvegarde `{ version: 2, fingerprint, actions }`.

## Points de vigilance (Review Focus)

1. **Carte volée qui meurt** : elle va au cimetière de son **propriétaire**, pas de celui qui la contrôlait. → test Tâche 3.
2. **Annulation après l'action d'un autre** : refusée, sinon on annulerait l'action d'un autre joueur. → test Tâche 6.
3. **Carte révélée puis mélangée dans la bibliothèque** : redevient cachée, même pour celui à qui elle avait été révélée. → test Tâche 5.
4. **Fuite par le journal** : la ligne publique d'un `look` ne nomme aucune carte, seule la ligne privée de l'auteur le fait. → test Tâche 5.
5. **Joueur éliminé pendant son tour** : le tour passe au suivant, sans faire piocher l'éliminé. → test Tâche 3.

---

## Carte des fichiers

| Action | Fichier | Responsabilité |
|---|---|---|
| Créer (T1–T6) puis déplacer (T7) | `lib/game/mp/types.ts` → `lib/game/types.ts` | Types et constantes de la spec |
| idem | `lib/game/mp/setup.ts` → `lib/game/setup.ts` | `createInitialState(setup)` |
| idem | `lib/game/mp/rules.ts` → `lib/game/rules.ts` | `canApply`, `controllerOf`, `zoneOf`, `isVisibleTo` |
| idem | `lib/game/mp/apply.ts` → `lib/game/apply.ts` | `applyAction`, journal, `cardName`, `cardData` |
| idem | `lib/game/mp/view.ts` → `lib/game/view.ts` | `viewFor` |
| idem | `lib/game/mp/replay.ts` → `lib/game/replay.ts` | `replay`, `GameHistory` |
| Modifier (T6) | `lib/game/storage.ts` | Version 2 |
| Supprimer (T7) | ancien `lib/game/{types,setup,apply,replay}.ts` et leurs tests | Remplacés |
| Inchangés | `lib/game/{random,tokens,keyboard,catalog}.ts` | — |
| Modifier (T7) | `components/playtest/*`, `app/decks/[id]/test/page.tsx` | Affichage via `viewFor`, actions avec `actor: 'solo'` |
| Créer | `test/game-fixtures.ts` | `twoDecks()`, `setupFor(format, n)` pour les tests |

---

### Tâche 1 : Types et mise en place

**Fichiers :** Créer `lib/game/mp/types.ts`, `lib/game/mp/setup.ts`, `lib/game/mp/setup.test.ts`, `test/game-fixtures.ts`

**Interfaces — Produit :**
- `types.ts` : tous les types de la spec (`Format`, `GameSetup`, `PlayerZone`, `ZoneRef`, `PlayerState`, `CardInstance`, `LogEntry`, `GameState`, `GameAction`, `CardView`, `PlayerView`) ; `FORMAT_RULES: Record<Format, { life: number; commanderDamage: boolean; firstPlayerDraws: boolean }>` ; `COMMANDER_DAMAGE_LETHAL = 21`, `POISON_LETHAL = 10`, `OPENING_HAND`, `SNAPSHOT_EVERY`, `COMMANDER_TAX_STEP`. `TokenData` et `Catalog` réexportés depuis les fichiers existants.
- `setup.ts` : `createInitialState(setup: GameSetup): GameState`.
- `test/game-fixtures.ts` : `setupFor(format: Format, n: 1 | 2 | 3 | 4 | 5, options?)` qui renvoie un `GameSetup` dont les joueurs `p1…pn` (« Alex », « Bob », « Chloé », « Dan », « Eva ») ont chacun le catalogue de `testDeckCards()` (Kenrith commandant, Sol Ring FR, 30 Forêts, Delver) ; `run(setup, ...actions)` qui rejoue.

- [ ] **Étape 1 : tests qui échouent**
  - `commander`, 4 joueurs : chaque joueur a 40 PV, 0 poison, `kept: false`, `mulligans: 0`, 32 cartes en bibliothèque et son Kenrith seul en zone de commandement ; identifiants `p2:c3-1` … `p2:c3-30` ; `owner` correct ; `knownBy: []`.
  - `duel`, 2 joueurs : 20 PV.
  - `turnOrder` égale l'ordre des joueurs avant `start` ; `turn === 1` ; `monarch`, `initiative` à `null` ; `log` vide.
- [ ] **Étape 2 : lancer** `npx vitest run lib/game/mp` → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(game): types et mise en place multijoueur`

### Tâche 2 : Droits (`canApply`)

**Fichiers :** Créer `lib/game/mp/rules.ts`, `lib/game/mp/rules.test.ts`

**Interfaces — Produit :**
- `zoneOf(state, id): ZoneRef | null`, `controllerOf(state, id): string | null` (joueur dont le champ de bataille contient la carte, sinon le propriétaire)
- `isVisibleTo(state, id, playerId): boolean` (règle de visibilité de la spec)
- `canApply(state, action): string | null`

- [ ] **Étape 1 : tests qui échouent** (4 joueurs, après `start`) : un test par ligne du tableau « Droits » de la spec, avec un cas permis et un cas refusé. En particulier :
  - `move` d'une carte du **cimetière de p2** vers le **champ de bataille de p1** par p1 → permis ;
  - la même carte vers le **cimetière de p3** par p1 → refusé (« Tu ne peux déplacer cette carte que sur ton champ de bataille ou chez son propriétaire ») ;
  - `move` d'une carte de la **main de p2** par p1 → refusé (« Cette carte est cachée ») ;
  - carte de la bibliothèque de p2 visible par p1 grâce à `look` → permis vers le champ de bataille de p1 ;
  - `endTurn` par un autre que le joueur actif → refusé (« Ce n'est pas ton tour ») ;
  - `commanderDamage` en `duel` → « Pas de blessures de commandant en Duel Commander » ; en `commander` sur soi-même avec son propre commandant → refusé ;
  - joueur éliminé qui tente `draw` → refusé (« Tu es éliminé ») ;
  - action d'un joueur inconnu → refusé ; `start` par un joueur → refusé ; second `start` → refusé.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter** (`canApply` ne lit que l'état, n'applique rien). **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(game): droits des actions multijoueur`

### Tâche 3 : Tour de jeu et déplacements

**Fichiers :** Créer `lib/game/mp/apply.ts`, `lib/game/mp/apply.turn.test.ts`

**Interfaces — Produit :** `applyAction(state, action): GameState` pour `start`, `mulligan`, `keep`, `draw`, `shuffle`, `endTurn`, `move`, `giveControl`, `eliminate` ; `cardName(state, catalogs, id)` (les catalogues sont pris dans `GameState` : ajouter `catalogs: Record<string, Catalog>` à `GameState`, rempli par `createInitialState`) ; `isLand(state, id)`.

- [ ] **Étape 1 : tests qui échouent**
  - **Immuabilité** (état gelé) et **action refusée → même référence** (`expect(applyAction(s, bad)).toBe(s)`).
  - `start { seed: 1 }` : 7 cartes en main pour chacun, `turnOrder` permutation des joueurs, déterministe ; journal « Début de partie : <nom> commence ».
  - `mulligan`, `keep` : par joueur ; `mulligan` après `keep` refusé.
  - `endTurn` : passe au suivant, qui dégage ses permanents et pioche 1 ; retour au premier → `turn` 2 ; en `duel`, au tout premier tour, le premier joueur ne pioche pas — vérifier sur un `endTurn` puis un second qui revient : le premier joueur pioche bien à son 2ᵉ tour.
  - **Élimination** (point de vigilance 5) : `eliminate` du joueur actif → le suivant devient actif et pioche, l'éliminé ne pioche pas ; dans l'ordre, l'éliminé est ensuite sauté.
  - `move` : réanimation (cimetière de p2 → champ de bataille de p1) ; la carte est contrôlée par p1, `owner` reste p2 ; puis `move` vers « graveyard » de **son propriétaire** (point de vigilance 1) → dans le cimetière de p2.
  - `move` d'un jeton hors champ de bataille → disparaît ; commandant qui quitte la zone de commandement → `commanderCasts` + 1 ; terrain de la main au champ de bataille → `stats.landsPlayed` + 1 pour le propriétaire.
  - `move` avec `faceDown: true` vers l'exil de son propriétaire → `faceDown` vrai, `knownBy` vaut `[actor]`.
  - `giveControl` : la carte passe du champ de bataille de p1 à celui de p3, engagée et avec ses marqueurs.
  - Journal en français, avec l'auteur, et « une carte » pour une carte cachée (déplacement vers une bibliothèque, ou face cachée).
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter** en réutilisant la logique du moteur solo (`lib/game/apply.ts` : insertion, remise à zéro, jetons, taxe, terrains), généralisée à `ZoneRef`. **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(game): tour de jeu et déplacements multijoueur`

### Tâche 4 : Cartes et compteurs de joueur

**Fichiers :** Modifier `lib/game/mp/apply.ts` ; Créer `lib/game/mp/apply.counters.test.ts`

**Interfaces — Produit :** `tap`, `untapAll`, `flip`, `faceDown`, `counter`, `createToken`, `commanderTax`, `life`, `poison`, `playerCounter`, `commanderDamage`, `setMonarch`, `setInitiative` ; `taxOf(state, id)`, `bottomCount(state, playerId)`, `cardData(state, id, lang): { name; image; typeLine; faces; hidden }`.

- [ ] **Étape 1 : tests qui échouent**
  - `tap` sur la créature d'un autre → permis et effectif ; `untapAll` ne dégage que ses propres permanents.
  - `flip` Delver (contrôleur) → image de la face B ; `faceDown`.
  - `counter` borné à 0 ; `createToken` sur le champ de bataille de l'auteur, identifiants `t1`, `t2` partagés entre joueurs.
  - `life` sur un autre joueur → journal « Bob : Alex 40 → 37 ».
  - `commanderDamage { target: p1, commander: <Kenrith de p2>, delta: 5 }` → `commanderDamage[id] = 5` et `life` 35 ; un second commandant (de p3) compté séparément ; borné à 0 en négatif (la vie remonte du même montant).
  - `poison` borné à 0 ; `playerCounter { name: 'Énergie' }`.
  - `setMonarch` : un seul détenteur ; `setMonarch(null)`. Idem `setInitiative`.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(game): actions sur les cartes et compteurs de joueur`

### Tâche 5 : Informations cachées et journal privé

**Fichiers :** Modifier `lib/game/mp/apply.ts` ; Créer `lib/game/mp/apply.hidden.test.ts`

**Interfaces — Produit :** `reveal`, `revealTop`, `toggleTopRevealed`, `look`, `search`, `endLook`.

- [ ] **Étape 1 : tests qui échouent** (en vérifiant `isVisibleTo` de la Tâche 2)
  - `reveal { ids: [carte de main], to: ['p3'] }` : visible par p3, pas par p2 ; puis la carte est remise en bibliothèque et mélangée → plus visible par p3 (point de vigilance 3).
  - `reveal { ids: 'hand', to: 'all' }`.
  - `look { target: 'p2', count: 3 }` par p1 : les 3 cartes du dessus de p2 sont visibles par p1 seulement ; `lookingAt.p1` contient p2 ; ligne publique « Alex regarde les 3 cartes du dessus de la bibliothèque de Bob » et ligne privée (`visibleTo: ['p1']`) « Tu as vu : … » (point de vigilance 4) ; `endLook { shuffle: false }` → plus visibles, `lookingAt.p1` vide.
  - `search` puis `move` d'une carte vers le champ de bataille de p1, puis `endLook { shuffle: true, seed }` → bibliothèque de p2 mélangée, une carte de moins.
  - `toggleTopRevealed` → la carte du dessus est visible par tous, puis une autre carte la remplace en haut après une pioche.
  - `revealTop` : journal public avec le nom de la carte.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(game): informations cachées`

### Tâche 6 : Vue par joueur, rejeu, annulation, sauvegarde

**Fichiers :** Créer `lib/game/mp/view.ts`, `lib/game/mp/replay.ts`, `lib/game/mp/view.test.ts`, `lib/game/mp/replay.test.ts` ; Modifier `lib/game/storage.ts`, `lib/game/storage.test.ts`

**Interfaces — Produit :**
- `viewFor(state, playerId): PlayerView` (types de la spec)
- `replay(setup, actions)` ; `class GameHistory { constructor(setup, actions?); state; actions; push(action): string | null; canUndo(actor): boolean; undo(actor): boolean }`
- `storage.ts` : `saveGame(catalog, actions)` et `loadGame(catalog)` en version 2 (inchangés en signature)

- [ ] **Étape 1 : tests qui échouent**
  - `viewFor` : ma main visible, les mains adverses sont des listes de `{ hidden: true }` de la bonne longueur ; une carte cachée n'a **aucune autre clé** (`Object.keys(card)` vaut `['hidden']`) ; `library` = `{ count, visible }` ; exil face cachée visible par l'exilant seulement ; joueur éliminé avec l'option → tout visible, sans l'option → règle normale ; journal filtré (la ligne privée de `look` n'apparaît que chez l'auteur).
  - **Anti-fuite** : partie à 4 joueurs, 200 actions aléatoires **valides** (générées avec `createRng(42)`, parmi `draw`, `move` vers des zones permises, `look`/`endLook`, `reveal`, `faceDown`, `endTurn`, `createToken` ; les actions que `canApply` refuse sont ignorées). Après chaque action, pour chaque joueur, aucun identifiant de carte **invisible pour lui** (`isVisibleTo` faux) n'apparaît dans `JSON.stringify(viewFor(state, joueur))`.
  - `GameHistory` : `push` d'une action refusée renvoie l'erreur et ne l'ajoute pas ; état égal à `replay` aux longueurs 19, 20, 21 et 41 ; `canUndo('p1')` vrai juste après une action de p1, **faux** si p2 a agi depuis (point de vigilance 2) ; `undo` refuse `start`.
  - `storage` : sauvegarde au format `{ version: 2, ... }` ; une sauvegarde `version: 1` → `null`.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit et push** `feat(game): vue par joueur, rejeu et annulation`

**▶ Point d'étape** : moteur multijoueur complet et testé, à côté de l'ancien. Bilan à l'utilisateur.

### Tâche 7 : Remplacement de l'ancien moteur et migration du mode test

**Fichiers :** déplacer `lib/game/mp/*` vers `lib/game/` (en écrasant `types.ts`, `setup.ts`, `apply.ts`, `replay.ts`) ; supprimer `lib/game/apply.base.test.ts`, `apply.advanced.test.ts`, l'ancien `setup.test.ts` et `replay.test.ts`, après avoir **porté** dans les nouveaux tests chaque cas qui n'y figure pas encore (liste à vérifier test par test : mulligan, dessus/dessous de bibliothèque, même zone, remise à zéro, taxe, terrains, journal, jetons, annulation d'un mulligan et d'un jeton) ; modifier `components/playtest/*`, `app/decks/[id]/test/page.tsx`

- [ ] **Étape 1 :** déplacement, mise à jour des imports, portage des cas manquants. `npm test` → tout passe.
- [ ] **Étape 2 : interface du mode test.**
  - `Playtest` construit le `GameSetup` solo et un `GameHistory`, et affiche `viewFor(state, 'solo')`.
  - Chaque action envoyée porte `actor: 'solo'`. `nextTurn` devient `endTurn`, et le bandeau « Garder » envoie `keep`.
  - Les zones lisent `view.players.solo.zones`.
  - La pile de la bibliothèque affiche `library.count`.
  - « Regarder les X du dessus » et « Chercher » envoient `look` / `search { target: 'solo' }`, et `PileModal` lit les cartes visibles dans `library.visible`. La fermeture envoie `endLook`, avec `shuffle` selon la case cochée.
  - `GameCard`, `PreviewPane` et `CardMenu` prennent une `CardView` et utilisent `cardData`.
  - Le journal affiche `log` sans le nom de l'auteur, puisqu'il est seul.
- [ ] **Étape 3 : vérifier** `npm test`, `npx tsc --noEmit` et `npx @cloudflare/next-on-pages` → OK.
- [ ] **Étape 4 : commit** `refactor(game): moteur multijoueur à la place du moteur solo ; mode test migré`

### Tâche 8 : Vérification du mode test dans le navigateur

- [ ] **Étape 1 :** base locale (migrations appliquées, deck de test de 40 cartes déjà en place), build, puis `wrangler pages dev`.
- [ ] **Étape 2 :** `node scripts/playtest-check.mjs …` → les 29 contrôles passent, sans erreur JavaScript. Seuls les sélecteurs peuvent être adaptés, jamais les attentes.
- [ ] **Étape 3 :** en cas d'échec, corriger avec `systematic-debugging` et relancer. Envoyer deux captures à l'utilisateur.
- [ ] **Étape 4 : commit et push** `test(playtest): mode test vérifié sur le moteur multijoueur`
