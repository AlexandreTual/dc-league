# Plan — Interface de table multijoueur

**Objectif :** remplacer la vue texte provisoire par une vraie table graphique de 2 à 5 joueurs, partagée avec le mode test solo.

**Architecture :** un composant `Table` unique (`components/table/`) consomme une `GameSource`, soit locale (mode test, moteur dans le navigateur), soit distante (WebSocket du sous-projet 2). La logique d'interface décidable sans React (rangées triées, repères d'activité, menus) vit dans des fonctions pures testées (`lib/game/battlefield.ts`, `activity.ts`, `menus.ts`). Le moteur gagne `moveTop` et `endTurn.byHost`.

**Pile :** Next.js 15 (edge), React, `@dnd-kit/core`, Tailwind, Vitest, Playwright (`playwright-core`).

**Spec :** `docs/superpowers/specs/2026-10-05-online-table-design.md`

## Contraintes globales

- `scripts/playtest-check.mjs` (32 vérifications) doit passer sur la nouvelle table **sans changer ses attentes** ; seuls des sélecteurs peuvent changer.
- Les zones gardent l'attribut `data-zone="<zone>"` et gagnent `data-player="<joueur>"` ; l'identifiant de dépôt dnd-kit est `"<joueur>:<zone>"`.
- Surbrillance d'une carte modifiée : **1,5 s** ; ligne d'activité : **4 s**, **3 au maximum** ; refus en rouge **4 s**.
- Hauteurs : barre ≈ 48 px, adversaires ≈ 42 %, moi ≈ 58 %. Vue « Tous » : 1 adversaire → agrandi d'office ; 2 → deux bandeaux pleine largeur ; 3–4 → grille de deux colonnes.
- Mention du journal : « (passé par l'hôte) ». Refus `moveTop` sur bibliothèque vide : « Bibliothèque vide ».
- Position d'un dépôt sur un champ de bataille : centre de l'aperçu (correctif du 5 octobre conservé).
- Aucune donnée de carte invisible ne doit apparaître côté client (règle du sous-projet 2, inchangée).

## Points de vigilance

1. **Ma carte lâchée sur le champ de bataille d'un adversaire** : le moteur refuse, la carte reste en place et le message s'affiche. → contrôle dans `online-check.mjs` (Tâche 8).
2. **Deux Forêts, l'une engagée** : deux piles distinctes dans les rangées, pas « Forêt ×2 ». → test en Tâche 2.
3. **Reconnexion** : la première vue ne fait rien briller ni défiler. → test en Tâche 2.
4. **Annulation par un autre joueur** (une carte disparaît d'une vue à l'autre) : `diffViews` ne plante pas et ne la signale pas. → test en Tâche 2.
5. **Spectateur** : aucune carte ne se glisse, aucun menu ne s'ouvre. → test en Tâche 3 (menus) et contrôle en Tâche 8.

---

### Tâche 1 : Moteur — `moveTop` et passage de tour par l'hôte

**Fichiers :** Modifier `lib/game/types.ts`, `lib/game/rules.ts`, `lib/game/apply.ts`, `lib/game/room.ts` ; Créer `lib/game/apply.top.test.ts` ; Modifier `lib/game/room.test.ts`.

**Interfaces — Produit :**
```ts
| { type: 'moveTop'; actor: string; to: ZoneRef; position?: Position; x?: number; y?: number; faceDown?: boolean }
| { type: 'endTurn'; actor: string; byHost?: boolean }
```
`ClientAction` (room.ts) inclut `moveTop` automatiquement ; `serverAction` retire `byHost` d'une action reçue d'un navigateur.

- [ ] **Étape 1 : tests qui échouent**
  - `moveTop { to: battlefield }` : la carte qui était `library[0]` est sur mon champ de bataille, journal avec son nom ; vers la main : journal « une carte : bibliothèque → main » ; `faceDown: true` vers l'exil : carte face cachée, connue de l'auteur seul.
  - `moveTop` vers une zone d'un autre joueur → refus du moteur (même message que `move`) ; bibliothèque vide → « Bibliothèque vide ».
  - `endTurn { byHost: true }` → dernière ligne « Tour N : nom (passé par l'hôte) ».
  - `room` : commande hôte `passTurn` → journal avec « (passé par l'hôte) » ; message `{ type: 'action', action: { type: 'endTurn', byHost: true } }` du joueur actif → journal **sans** la mention.
- [ ] **Étape 2 : lancer** `npx vitest run lib/game` → FAIL. **Étape 3 : implémenter** (`moveTop` : résoudre l'identifiant puis réutiliser la validation et l'effet de `move`). **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(game): déplacer la carte du dessus et tour passé par l'hôte`

### Tâche 2 : Rangées triées et repères d'activité

**Fichiers :** Créer `lib/game/battlefield.ts`, `lib/game/battlefield.test.ts`, `lib/game/activity.ts`, `lib/game/activity.test.ts`.

**Interfaces — Produit :**
```ts
type Stack = { key: string; cards: VisibleCard[]; count: number }
groupBattlefield(cards: CardView[], catalogs: Record<string, Catalog>): { creatures: Stack[]; others: Stack[]; lands: Stack[]; hidden: number }
diffViews(prev: PlayerView | null, next: PlayerView, me: string | null): { changed: string[]; lines: { actor: string; text: string }[] }
```

- [ ] **Étape 1 : tests qui échouent**
  - `groupBattlefield` : Delver (créature) → `creatures` ; Anneau solaire → `others` ; Forêt → `lands` ; jeton « Soldat » (`Token Creature`) → `creatures` ; carte face cachée → `others` ; 3 Forêts dégagées → une pile `count: 3` ; 2 Forêts dont 1 engagée → deux piles (point 2) ; même carte avec marqueurs différents → deux piles ; ordre = ordre d'arrivée ; `{ hidden: true }` comptées dans `hidden`.
  - `diffViews` : `prev = null` → `{ changed: [], lines: [] }` (point 3) ; carte passée de la main au champ de bataille → dans `changed` ; engagement, marqueur, retournement → dans `changed` ; carte absente de `next` (annulée) → ni erreur ni signalement (point 4) ; nouvelles lignes du journal d'un autre → dans `lines` ; mes propres lignes → exclues ; spectateur (`me = null`) → toutes les lignes.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(table): rangées triées et repères d'activité`

### Tâche 3 : Menus contextuels

**Fichiers :** Créer `lib/game/menus.ts`, `lib/game/menus.test.ts`.

**Interfaces — Produit :**
```ts
type MenuCommand =
  | { kind: 'action'; action: ClientAction }
  | { kind: 'ask'; question: string; fallback: number; then: (n: number) => MenuCommand[] }  // « Regarder les X… »
  | { kind: 'openPile'; player: string; zone: 'library' | 'graveyard' | 'exile'; mode: 'look' | 'search' | 'browse'; title: string }
type MenuEntry = { kind: 'title'; label: string } | { kind: 'separator' }
  | { kind: 'item'; label: string; commands: MenuCommand[] }
  | { kind: 'stepper'; label: string; value: number | string; minus: MenuCommand; plus: MenuCommand }
type MenuContext = { me: string | null; view: PlayerView; catalogs: Record<string, Catalog>; lang: 'fr' | 'en'; readOnly: boolean }
cardMenu(ctx: MenuContext, card: VisibleCard, zone: ZoneRef): MenuEntry[]
libraryMenu(ctx: MenuContext, player: string): MenuEntry[]
handMenu(ctx: MenuContext): MenuEntry[]
```
Libellés exacts du tableau de la spec (§3 « Menus clic droit ») et du mode test actuel.

- [ ] **Étape 1 : tests qui échouent** (un test par ligne du tableau) : ma carte sur mon champ de bataille contient « Donner le contrôle à Bob » et « Donner le contrôle à Chloé » ; carte de Bob sur son champ de bataille : « Prendre le contrôle » (`move` vers mon champ de bataille), « Dans son cimetière » (`move` vers `{ player: bob, zone: graveyard }`), pas de « Retourner » ; cimetière de Bob : « Sur mon champ de bataille » ; ma main : « Révéler à tous », « Révéler à Bob » ; `libraryMenu` de Bob : « Regarder les X du dessus… » (`ask` → `look`), « Chercher… » ; `libraryMenu` à moi : entrées du mode test + « Jouer avec la carte du dessus révélée » ; spectateur (`me = null`) → `[]` partout ; partie finie → `[]` (point 5).
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(table): menus contextuels`

### Tâche 4 : Source de partie et table solo (migration du mode test)

**Fichiers :** Créer `components/table/source.ts`, `components/table/useLocalSource.ts`, `components/table/Table.tsx`, `components/table/MyBoard.tsx` ; Déplacer `components/playtest/{GameCard,Draggable,CardMenu,PileModal,TokenModal,LogPanel,PreviewPane,TopBar,zones}.tsx` → `components/table/` ; Supprimer `components/playtest/Playtest.tsx` ; Modifier `app/decks/[id]/test/page.tsx`, `scripts/playtest-check.mjs` (sélecteurs seulement).

**Interfaces — Produit :** `GameSource` (spec §2 ; la reprise de partie est gérée par `LocalTable`, hors de la source) ; `useLocalSource(catalog, deckName): LocalPhase` (`loading` / `resume` / `playing` avec la source) ; `<LocalTable>` pour la page de test ; `<Table source={GameSource} />`. Zones paramétrées par `player`, `interactive` ; dépôt `"<joueur>:<zone>"` ; menus construits par `cardMenu` / `libraryMenu` / `handMenu` ; glisser ma bibliothèque → `moveTop`.

- [ ] **Étape 1 :** extraire la logique de `Playtest.tsx` dans `useLocalSource` (historique, sauvegarde v2, reprise, graines, « Garder » implicite) et la mise en page dans `Table` + `MyBoard`, sans changer le rendu.
- [ ] **Étape 2 : vérifier** `npm test`, `npx tsc --noEmit`, build ; `node scripts/playtest-check.mjs …` → les 32 contrôles ✓, aucune erreur JavaScript.
- [ ] **Étape 3 : commit et push** `refactor(table): table partagée, mode test migré`

**▶ Point d'étape :** mode test sur la nouvelle table, identique pour l'utilisateur. Bilan.

### Tâche 5 : Adversaires — bandeaux, vue agrandie, compteurs

**Fichiers :** Créer `components/table/PlayerPanel.tsx`, `OpponentStrip.tsx`, `OpponentBoard.tsx`, `OpponentsArea.tsx`, `components/table/useRemoteSource.ts` ; Modifier `Table.tsx`, `components/online/TableView.tsx` ; Supprimer `components/online/MinimalGame.tsx`.

**Interfaces — Consomme :** `groupBattlefield` (T2), `cardMenu` (T3), `useGameSocket`. **Produit :** `useRemoteSource(tableId: string): GameSource`.

- [ ] **Étape 1 :** `PlayerPanel` (nom, point en ligne, couronne d'hôte, joueur actif en surbrillance, « choisit sa main… » si `!kept`, grisé si éliminé ; vie −/+ avec Maj = ±5 ; poison ; en Commander une ligne de blessures par commandant adverse, alerte visuelle à 21 ; compteurs libres « + compteur » par nom ; boutons Monarque / Initiative) — actions `life`, `poison`, `commanderDamage`, `playerCounter`, `setMonarch`, `setInitiative`.
- [ ] **Étape 2 :** `OpponentStrip` (rangées de `groupBattlefield`, « ×N », dos de carte pour la main, nombre de cartes en bibliothèque, piles miniatures cliquables → `PileModal` en consultation) ; `OpponentBoard` (zones réelles, droppables) ; `OpponentsArea` (vue « Tous » / agrandie avec onglets nom + vie, bouton « Tous », Duel agrandi d'office, disposition des Contraintes globales).
- [ ] **Étape 3 :** `useRemoteSource` ; `/tables/[id]` affiche `Table` ; spectateur : moitié basse remplacée par les bandeaux restants + « Tu regardes cette partie ».
- [ ] **Étape 4 : vérifier** `npm test`, `tsc`, build ; `playtest-check` → 32 ✓.
- [ ] **Étape 5 : commit** `feat(table): adversaires, vue agrandie et compteurs de joueur`

### Tâche 6 : Actions multijoueur dans la table

**Fichiers :** Modifier `Table.tsx`, `TopBar.tsx`, `PileModal.tsx`, `MyBoard.tsx`, `OpponentBoard.tsx`.

- [ ] **Étape 1 :** brancher toutes les entrées de `cardMenu` / `libraryMenu` / `handMenu` (révéler, donner / prendre le contrôle, regarder / chercher dans la bibliothèque d'un autre avec `endLook` à la fermeture, carte du dessus révélée) ; glisser depuis le cimetière ou l'exil d'un autre vers mon champ de bataille.
- [ ] **Étape 2 :** `TopBar` en ligne : Abandonner (confirmation → `concede`), menu Hôte (« Passer le tour de X » visible si X est actif et ≠ moi, « Éliminer X », « Clore la partie », confirmations) ; bandeau de fin « Victoire de X » / « Partie close » et table en lecture seule ; spectateur : `Draggable` désactivé, aucun menu.
- [ ] **Étape 3 : vérifier** `npm test`, `tsc`, build, `playtest-check` → 32 ✓.
- [ ] **Étape 4 : commit** `feat(table): actions multijoueur, hôte et fin de partie`

### Tâche 7 : Repères d'activité et erreurs

**Fichiers :** Créer `components/table/ActivityFeed.tsx` ; Modifier `Table.tsx`, `GameCard.tsx`, `LogPanel.tsx`.

- [ ] **Étape 1 :** `Table` garde la vue précédente (remise à `null` à chaque reconnexion) et appelle `diffViews` ; `GameCard` reçoit `highlight` (anneau doré 1,5 s) ; `ActivityFeed` affiche les `lines` (4 s, 3 max) et `source.error` en rouge 4 s ; bandeau « Reconnexion… » et actions désactivées quand `status !== 'open'` ; `LogPanel` préfixe le nom de l'auteur quand il y a plus d'un joueur.
- [ ] **Étape 2 : vérifier** `npm test`, `tsc`, build, `playtest-check` → 32 ✓.
- [ ] **Étape 3 : commit** `feat(table): repères d'activité et erreurs`

### Tâche 8 : Vérification de bout en bout

**Fichiers :** Réécrire `scripts/online-check.mjs` ; Modifier `scripts/seed-online.mjs` si besoin (cartes au cimetière par une action, pas en base).

- [ ] **Étape 1 :** Worker, site et données comme au sous-projet 2 ; scénario de la spec (§6) : rangées de Bastien chez Ana ; carte jouée par Bastien en surbrillance et ligne d'activité chez Ana ; Bastien agrandit Ana et glisse une carte de son cimetière vers son champ de bataille ; Ana lâche sa carte sur le champ de bataille de Bastien → refus affiché, carte en place (point 1) ; Chloé retire 3 PV à Ana et ajoute 5 blessures de commandant, vu par tous ; Ana regarde les 3 du dessus de Bastien (aucune donnée de ces cartes dans les messages de Chloé ni du spectateur) ; glisser de sa bibliothèque vers son champ de bataille (`moveTop`) ; spectateur : aucun menu au clic droit, aucune carte déplaçable (point 5) ; l'hôte passe le tour de Chloé (« (passé par l'hôte) » au journal) ; abandon, élimination, « Victoire de Ana » ; aucune erreur JavaScript.
- [ ] **Étape 2 :** `playtest-check` → 32 ✓. Captures : vue « Tous » à 4 (table à 4 places), vue agrandie, Duel, mode test ; les envoyer à l'utilisateur.
- [ ] **Étape 3 :** en cas d'échec, `systematic-debugging`, corriger, relancer.
- [ ] **Étape 4 : commit et push** `test(table): table multijoueur vérifiée de bout en bout` ; feuille de route : sous-projet 3 terminé.
