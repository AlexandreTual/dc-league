# Plan — Serveur temps réel et salon

**Objectif :** jouer en ligne à 2–5 avec le moteur du sous-projet 1 : salon, salle d'attente, partie en direct par WebSocket, spectateurs, reprise et nettoyage.

**Architecture :** un Worker séparé `dc-league-game` héberge un Durable Object `GameRoom` par table ; le site Pages y transmet la WebSocket après vérification de la session (repli B : jeton signé). La logique de table est pure (`lib/game/room.ts`) ; la persistance est isolée dans un « runtime » testable (`workers/game/runtime.ts`) ; le Durable Object n'est qu'une enveloppe. Le salon vit dans D1.

**Pile :** Next.js 15 (edge), `@cloudflare/next-on-pages`, D1, Wrangler 4 (Durable Objects SQLite, API WebSocket à hibernation, cron), Vitest, Playwright (`playwright-core`).

**Spec :** `docs/superpowers/specs/2026-10-04-game-server-lobby-design.md`

## Contraintes globales

- Places : 2 à 5 ; Duel : exactement 2.
- Hôte absent depuis plus de **5 minutes** → rôle transmis au premier joueur connecté suivant dans l'ordre des places ; pas de retour automatique.
- Nettoyage : tables inactives depuis plus de **7 jours** (tous statuts), cron quotidien `17 3 * * *`.
- Messages WebSocket : max **16 Ko**, max **20 messages/s** par socket, JSON invalide ignoré.
- `touchActivity` en D1 au plus **une fois par minute** par table.
- Salle d'attente rafraîchie toutes les **3 s**.
- Le serveur impose `actor` et tire toutes les graines ; il retire tout `X-Player-Id` venu du navigateur.
- Seules les données de cartes **visibles** par un destinataire lui sont envoyées.
- Le Worker n'a aucune adresse publique (`workers_dev = false`) en approche A.
- Fichiers importés par le Worker : **imports relatifs uniquement** (pas d'alias `@/`).
- Messages en français, mots exacts de la spec (« Table complète », « Seul l'hôte peut faire ça », « Les spectateurs ne peuvent pas jouer », « La partie est terminée », « Rien à annuler », « Réessaie »…).

## Points de vigilance

1. **Un joueur dans deux onglets** : fermer un onglet ne le rend pas absent (compteur de sockets). → test en Tâche 4.
2. **L'ancien hôte qui revient** ne redevient pas hôte. → test en Tâche 4.
3. **Champs `actor` / `seed` envoyés par le navigateur** : écrasés par le serveur. → test en Tâche 3.
4. **Réveil après hibernation** : le cache « cartes déjà envoyées » est perdu → la prochaine vue renvoie toutes les cartes visibles, sans erreur. → test en Tâche 5.
5. **Deck supprimé après avoir été choisi** (`deck_id` passe à NULL) : le démarrage est refusé avec « Chaque joueur doit choisir un deck ». → test en Tâche 6.

## Ajustement de la spec

Les fonctions de `room.ts` renvoient des **effets** plutôt que des messages prêts à l'envoi : les données de cartes dépendent de ce que chaque socket a déjà reçu, et seul le runtime connaît les sockets. `viewMessageFor` reste la fonction qui fabrique le message d'une socket.

---

### Tâche 1 : Vérification de la WebSocket site → Durable Object, squelette du Worker

**Fichiers :** Créer `workers/game/wrangler.toml`, `workers/game/index.ts`, `workers/game/room-do.ts` (version écho), `workers/game/tsconfig.json`, `app/api/games/[id]/ws/route.ts` (version provisoire), `scripts/ws-spike.mjs` ; Modifier `wrangler.toml`, `cloudflare-env.d.ts`, `package.json` (script `game:dev`).

**Interfaces — Produit :** `CloudflareEnv.GAME: DurableObjectNamespace` ; `gameStub(env, tableId): DurableObjectStub` dans `lib/games/binding.ts` (`env.GAME.get(env.GAME.idFromName(tableId))`).

- [ ] **Étape 1 :** `workers/game/wrangler.toml` : `name = "dc-league-game"`, `main = "index.ts"`, `compatibility_date = "2024-09-23"`, `compatibility_flags = ["nodejs_compat"]`, `workers_dev = false`, `[[durable_objects.bindings]] name = "GAME" class_name = "GameRoom"`, `[[migrations]] tag = "v1" new_sqlite_classes = ["GameRoom"]`, `[[d1_databases]]` identique au site (`migrations_dir = "../../migrations"`), `[triggers] crons = ["17 3 * * *"]`.
- [ ] **Étape 2 :** `GameRoom` écho : accepte la WebSocket (`ctx.acceptWebSocket`), renvoie `{ echo, player: <X-Player-Id> }` à chaque message.
- [ ] **Étape 3 :** site : `[[durable_objects.bindings]] name = "GAME" class_name = "GameRoom" script_name = "dc-league-game"` ; route `GET /api/games/[id]/ws` qui transmet la requête à `gameStub(env, id).fetch(...)` avec `X-Player-Id` fixé (provisoirement l'id du joueur connecté) et renvoie la réponse telle quelle.
- [ ] **Étape 4 : vérifier.** `npm run game:dev` (`cd workers/game && wrangler dev --port 8787 --persist-to ../../.wrangler/state`) et `wrangler pages dev --port 8788` après build ; `node scripts/ws-spike.mjs http://localhost:8788 <cookie>` ouvre `ws://localhost:8788/api/games/t1/ws` (WebSocket natif de Node) et attend l'écho.
  Attendu : `écho reçu : {"echo":"ping","player":"<id>"}`.
- [ ] **Étape 5 : décision.** Écho reçu → approche A, on continue. Sinon (après diagnostic `systematic-debugging`) → repli B : noter la décision ici, ajouter au Worker une route publique `/ws/<id>?t=<jeton>`, passer `workers_dev = true`, et créer en Tâche 6 `GET /api/games/[id]/ticket` (HMAC-SHA256 de `tableId.playerId.exp` avec `GAME_TICKET_SECRET`, validité 60 s) avec ses tests. Prévenir l'utilisateur.
> **Résultat (fait) :** approche A retenue. Le Durable Object répondait bien `101`, mais next-on-pages 1.13.16 recopie chaque réponse (`new Response(body, { ...resp })`) et perd la WebSocket. Correctif d'une ligne appliqué par `scripts/patch-next-on-pages.mjs` (lancé en `postinstall`, échoue si le code visé change) ; version de next-on-pages figée à 1.13.16. Vérifié dans Chromium : `écho reçu : {"echo":"ping","player":"p2"}`.
- [ ] **Étape 6 : commit** `feat(online): squelette du Worker de jeu et liaison WebSocket`

### Tâche 2 : Tables du salon en D1

**Fichiers :** Créer `migrations/0004_game_tables.sql` (SQL exact de la spec), `lib/db-games.ts`, `lib/db-games.test.ts` ; Modifier `test/d1.ts` (ajouter `0004_game_tables.sql`).

**Interfaces — Produit :**
```ts
type GameTable = { id; hostPlayerId; format: Format; seats: number; eliminatedSeeAll: boolean; status: 'open' | 'playing' | 'finished';
  winnerPlayerId: string | null; createdAt; lastActivityAt; players: { playerId; name; deckId: string | null; deckName: string | null; seat: number }[] }
createTable(db, { hostPlayerId, format, seats, eliminatedSeeAll }): Promise<Result<GameTable>>
listTables(db): Promise<Result<GameTable[]>>          // open + playing, plus récentes d'abord
getTable(db, id): Promise<Result<GameTable | null>>
joinTable(db, id, playerId), leaveTable(db, id, playerId), removeSeat(db, id, hostId, playerId),
chooseDeck(db, id, playerId, deckId): Promise<Result<GameTable>>
startCheck(table): string | null                      // pure : raison du refus ou null
markPlaying(db, id), touchActivity(db, id, now: Date), finishTable(db, id, winner: string | null),
setHost(db, id, playerId), deleteTable(db, id): Promise<Result<null>>
staleTables(db, before: Date): Promise<Result<string[]>>
```
Fichier en imports relatifs (`./db` pour `Result`) : il est aussi utilisé par le Worker.

- [ ] **Étape 1 : tests qui échouent**
  - `createTable` : l'hôte occupe la place 1 ; Duel force `seats = 2`.
  - `joinTable` : place suivante ; 2e fois → sans effet ; table pleine → « Table complète » ; `playing` → « La partie a déjà commencé » ; inconnue → « Table introuvable ».
  - `leaveTable` de l'hôte avant départ : l'hôte devient le joueur suivant ; dernier joueur qui part → table supprimée.
  - `removeSeat` par un non-hôte → « Seul l'hôte peut faire ça ».
  - `chooseDeck` avec le deck d'un autre → « Ce deck n'est pas à toi ».
  - `startCheck` : 1 joueur → « Il faut au moins 2 joueurs » ; Duel à 3 impossible par construction, Duel à 1 → idem ; un deck manquant (y compris supprimé : `deck_id` NULL) → « Chaque joueur doit choisir un deck ».
  - `listTables` exclut `finished` ; `staleTables` renvoie les tables (tous statuts) dont `last_activity_at < before` ; `deleteTable` supprime aussi les places.
- [ ] **Étape 2 : lancer** `npx vitest run lib/db-games` → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(online): tables du salon en base`

### Tâche 3 : Logique de table — actions, vues, données de cartes

**Fichiers :** Créer `lib/game/room.ts`, `lib/game/room.test.ts`.

**Interfaces — Produit :**
```ts
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
type ClientAction = DistributiveOmit<Exclude<GameAction, { type: 'start' }>, 'actor' | 'seed'>
type ClientMessage = { type: 'action'; action: ClientAction } | { type: 'undo' } | { type: 'concede' }
  | { type: 'host'; op: 'passTurn' | 'eliminate'; target: string } | { type: 'host'; op: 'close' }
type CardDataMap = Record<string, Record<number, CatalogEntry>>
type ServerMessage =
  | { type: 'view'; view: PlayerView; cards: CardDataMap; host: string; online: string[]; finished: boolean; winner: string | null }
  | { type: 'rejected'; error: string }
type RoomState = { tableId; hostId; seats: { playerId; name }[]; history: GameHistory; online: Record<string, number>;
  absentSince: Record<string, number>; finished: boolean; winner: string | null }
type RoomEvent = { type: 'hostChanged'; hostId: string } | { type: 'finished'; winner: string | null }
type Outcome = { changed: boolean; error: string | null; events: RoomEvent[] }

createRoom(tableId: string, setup: GameSetup, hostId: string, seed: number): RoomState   // joue start
restoreRoom(tableId, setup, hostId, actions: GameAction[], meta: { finished; winner }): RoomState
handleMessage(room, from: string | null, msg: ClientMessage, ctx: { now: number; seed: () => number }): Outcome
viewMessageFor(room, viewer: string | null, alreadySent: CardDataMap): Extract<ServerMessage, { type: 'view' }>
```
`room.history` est modifié en place ; le reste de `room` aussi (objet propre au runtime).

- [ ] **Étape 1 : tests qui échouent** (fixtures `setupFor` de `test/game-fixtures.ts`)
  - action de p1 : `actor` imposé à p1 même si le message contient `actor: 'p2'` ; `seed` du navigateur ignoré (mulligan avec `seed: 1` et `ctx.seed = () => 77` ≡ `mulligan seed 77`).
  - `from = null` ou hors des places → error « Les spectateurs ne peuvent pas jouer », `changed: false`.
  - action refusée par le moteur → `error` = message du moteur, `changed: false`, historique inchangé.
  - `undo` sans rien à annuler → « Rien à annuler » ; après une pioche de p1 → `changed: true`.
  - `concede` → p1 éliminé.
  - `viewMessageFor(room, 'p2', {})` : `cards` contient les entrées de toutes les cartes visibles par p2 (main de p2, commandants) et **aucune** de la main de p1 ; avec `alreadySent` déjà rempli → `cards` vide ; spectateur (`null`) : vue publique, mains cachées.
  - **anti-fuite** : 4 joueurs, `createRng(42)`, 200 messages aléatoires (actions variées comme le test de `view.test.ts`, plus `undo`, `concede` rares) ; après chacun, pour p1…p4 et le spectateur, `viewMessageFor` avec leur cache : chaque `(owner, ref)` de `cards` correspond à une carte actuellement visible par ce destinataire.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter** (`seed` ajouté pour `mulligan`, `shuffle`, `endLook` ; cartes visibles = toutes les `VisibleCard` de la vue, y compris `library.visible`, hors jetons). **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(online): logique de table (actions, vues, données de cartes)`

### Tâche 4 : Logique de table — présence, hôte, fin de partie

**Fichiers :** Modifier `lib/game/room.ts`, `lib/game/room.test.ts`.

**Interfaces — Produit :** `handleConnect(room, playerId: string | null, now): Outcome`, `handleDisconnect(room, playerId: string | null, now): Outcome`, `onlinePlayers(room): string[]`.

- [ ] **Étape 1 : tests qui échouent**
  - deux connexions de p1 puis une déconnexion → p1 toujours en ligne (point 1).
  - hôte p1 déconnecté à t ; message de p2 à t + 4 min 59 → hôte inchangé ; à t + 5 min 01 → hôte = premier joueur **connecté** après p1 dans l'ordre des places, événement `hostChanged` ; p1 se reconnecte → reste non-hôte (point 2).
  - `host passTurn` par l'hôte sur le joueur actif → tour passé ; sur un autre → « Ce n'est pas son tour » ; par un non-hôte → « Seul l'hôte peut faire ça ».
  - `host eliminate` → cible éliminée.
  - fin : 3 joueurs, deux éliminés → `finished`, `winner` = le dernier, événement `finished` ; toute action ensuite → « La partie est terminée ».
  - `host close` → `finished`, `winner: null`.
  - partie solo (1 joueur) : jamais de fin automatique.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter** (contrôle de transmission en tête de `handleMessage` et `handleConnect`). **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(online): présence, pouvoirs de l'hôte et fin de partie`

### Tâche 5 : Runtime du Durable Object et persistance

**Fichiers :** Créer `workers/game/runtime.ts`, `workers/game/runtime.test.ts`, `workers/game/cleanup.ts` ; Modifier `workers/game/room-do.ts` (remplace l'écho), `workers/game/index.ts`, `vitest.config` si besoin pour inclure `workers/**`.

**Interfaces — Produit :**
```ts
interface KvStorage { get<T>(key: string): Promise<T | undefined>; get<T>(keys: string[]): Promise<Map<string, T>>
  put(key: string, value: unknown): Promise<void>; delete(key: string | string[]): Promise<unknown>
  list<T>(opts: { prefix: string }): Promise<Map<string, T>>; deleteAll(): Promise<void> }
interface Socket { send(data: string): void; close(code?: number, reason?: string): void }
type SocketInfo = { playerId: string | null }
class RoomRuntime {
  constructor(storage: KvStorage, db: D1Database, sockets: () => { socket: Socket; info: SocketInfo }[], clock: () => number, seed: () => number)
  load(): Promise<void>; state(): RoomState | null
  init(body: { tableId: string; setup: GameSetup; hostId: string }): Promise<Response>  // 409 si déjà initialisé
  connect(socket: Socket, info: SocketInfo): Promise<void>                      // envoie la vue complète
  message(socket: Socket, info: SocketInfo, raw: string): Promise<void>
  disconnect(socket: Socket, info: SocketInfo): Promise<void>
  destroy(): Promise<void>                                                      // deleteAll + ferme les sockets
}
cleanupStale(env: { DB: D1Database; GAME: DurableObjectNamespace }, now: Date): Promise<number>
```
Clés : `setup`, `meta` (`{ hostId, finished, winner }`), `a:000000`… (index sur 6 chiffres). Le cache des cartes envoyées et les compteurs de débit sont en mémoire (perdus au réveil, c'est voulu).

- [ ] **Étape 1 : tests qui échouent** (stockage `Map` en mémoire, sockets factices qui accumulent les messages, D1 de `test/d1.ts`)
  - `init` puis `connect` p1 → un message `view` ; 2e `init` → 409.
  - action acceptée → clé `a:000001` écrite **avant** l'envoi des vues (le stockage factice enregistre l'ordre) ; `undo` supprime la dernière clé.
  - `put` qui lève → action retirée de l'historique, auteur reçoit `rejected` « Réessaie », aucune diffusion.
  - message de 16 Ko + 1 → ignoré ; JSON invalide → ignoré ; 21e message dans la même seconde → ignoré.
  - **réveil** : nouveau `RoomRuntime` sur le même stockage → état égal ; première vue envoyée à une socket recontient toutes les cartes visibles (point 4).
  - D1 : `touchActivity` une seule fois pour 3 actions en 30 s, une 2e après 61 s ; `finished` → `finishTable` avec le vainqueur ; `hostChanged` → `setHost`.
  - `cleanupStale` : appelle `DELETE` sur le `GameRoom` des tables périmées et les supprime de D1 (faux namespace).
- [ ] **Étape 2 : lancer** `npx vitest run workers/game` → FAIL. **Étape 3 : implémenter** ; `GameRoom` (`room-do.ts`) : `fetch` → `/init` (POST), `/ws` (upgrade : `acceptWebSocket` avec `serializeAttachment({ playerId })`), `DELETE` ; `webSocketMessage` / `webSocketClose` → runtime (chargé paresseusement). `index.ts` : `scheduled` → `cleanupStale`.
- [ ] **Étape 4 : lancer** → PASS ; `npx wrangler deploy --dry-run` dans `workers/game` → build OK.
- [ ] **Étape 5 : commit et push** `feat(online): Durable Object de table et persistance`

**▶ Point d'étape :** serveur de jeu complet et testé. Bilan à l'utilisateur.

### Tâche 6 : Routes du salon, démarrage et WebSocket

**Fichiers :** Créer `lib/games/binding.ts` (déjà amorcé en Tâche 1), `lib/games/start.ts`, `lib/games/start.test.ts`, `app/api/games/route.ts`, `app/api/games/[id]/route.ts`, `app/api/games/[id]/{join,leave,deck,kick,start}/route.ts` ; Modifier `app/api/games/[id]/ws/route.ts`.

**Interfaces — Produit :**
```ts
type GameInit = (tableId: string, body: { setup: GameSetup; hostId: string }) => Promise<{ ok: boolean; status: number }>
startTable(db: D1Database, init: GameInit, tableId: string, playerId: string): Promise<Result<GameTable>>
```
Routes : `requirePlayer` partout, `assertSameOrigin` sur les POST ; corps JSON `{ format, seats, eliminatedSeeAll }`, `{ deckId }`, `{ playerId }` ; erreurs métier → 400 (403 pour « Seul l'hôte… », 404 pour « Table introuvable ») avec `{ error }`.

- [ ] **Étape 1 : tests qui échouent** (`start.test.ts`, D1 de test, `init` factice)
  - non-hôte → « Seul l'hôte peut faire ça », `init` jamais appelé.
  - deck supprimé après choix → « Chaque joueur doit choisir un deck » (point 5).
  - succès : `init` reçoit un `GameSetup` avec les joueurs dans l'ordre des places, `name` = nom du joueur, catalogues construits par `buildCatalog` depuis `deck_cards` (fixtures `seedCache`), format et option de la table ; table `playing`.
  - `init` qui échoue (status 500) → table reste `open`, erreur « Erreur interne, réessaie plus tard ».
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter** `startTable`, puis les routes (minces, comme `app/api/decks/[id]/import/commit/route.ts`). Route `ws` : refuse sans `Upgrade: websocket` (426), sans session (401), origine étrangère (403) ; copie la requête **sans** les en-têtes `X-Player-Id`/`X-Spectator` du navigateur, ajoute `X-Player-Id` si le joueur occupe une place de cette table, sinon `X-Spectator: 1`.
- [ ] **Étape 4 : lancer** `npm test` → PASS ; `npx tsc --noEmit` → OK.
- [ ] **Étape 5 : commit** `feat(online): routes du salon et démarrage des parties`

### Tâche 7 : Pages Salon et salle d'attente

**Fichiers :** Créer `app/salon/page.tsx`, `app/tables/[id]/page.tsx`, `components/online/Lobby.tsx`, `components/online/WaitingRoom.tsx` ; Modifier `components/Navbar.tsx`.

**Interfaces — Consomme :** routes de la Tâche 6 ; `listPlayerDecks(db, playerId)` de `lib/db-decks.ts` pour le sélecteur de deck.

- [ ] **Étape 1 :** `/salon` (connexion requise, sinon redirection `/connexion`) : tables `open` (format, « 2/4 », hôte, « Rejoindre ») et `playing` (« Regarder ») ; formulaire « Créer une table » (format, places 2–5 masqué en Duel, case « Un joueur éliminé voit tout »), redirection vers `/tables/<id>`.
- [ ] **Étape 2 :** `/tables/[id]` statut `open` : places et decks choisis, sélecteur de mes decks, « Copier le lien », « Partir » ; pour l'hôte « Retirer » et « Démarrer » (désactivé avec la raison de `startCheck`) ; rafraîchissement toutes les 3 s ; passage automatique à la vue de jeu quand le statut devient `playing`.
- [ ] **Étape 3 :** lien « Salon » dans la navigation pour un joueur connecté.
- [ ] **Étape 4 : vérifier** `npx tsc --noEmit`, `npx @cloudflare/next-on-pages` → OK.
- [ ] **Étape 5 : commit** `feat(online): salon et salle d'attente`

### Tâche 8 : Vue de jeu minimale et connexion

**Fichiers :** Créer `components/online/useGameSocket.ts`, `components/online/MinimalGame.tsx`, `components/online/cards-cache.ts`, `components/online/cards-cache.test.ts` ; Modifier `app/tables/[id]/page.tsx`.

**Interfaces — Produit :**
```ts
useGameSocket(tableId: string): { status: 'connecting' | 'open' | 'reconnecting'; last: ServerViewMessage | null;
  cards: CardDataMap; error: string | null; send(msg: ClientMessage): void }
mergeCards(prev: CardDataMap, next: CardDataMap): CardDataMap    // pur
```
Reconnexion : délais 1, 2, 4, 8, puis 15 s maximum ; remise à 1 s après une connexion réussie.

- [ ] **Étape 1 : test qui échoue** `mergeCards` : fusionne par propriétaire sans écraser les autres propriétaires ; n'altère pas `prev`.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter** le hook et `MinimalGame` : par joueur (ordre du tour, actif en évidence, hôte marqué, point vert si en ligne) PV, poison, main (nombre), bibliothèque (nombre), champ de bataille / cimetière / exil / commandement en listes de noms (`cardInfo` avec le catalogue reconstitué depuis `cards`) ; ma main en liste avec bouton « Jouer » (move vers mon champ de bataille) ; journal ; boutons Garder, Mulligan, Piocher, Fin du tour, Annuler (désactivé si `!view.canUndo`), Abandonner (confirmation) ; hôte : « Passer le tour de X », « Éliminer X », « Clore la partie » ; bandeau « Reconnexion… » ; message d'erreur `rejected` pendant 4 s ; partie finie : « Victoire de X » ou « Partie close », lecture seule ; spectateur : bandeau « Tu regardes cette partie ».
- [ ] **Étape 4 : lancer** → PASS ; `npx tsc --noEmit` et build → OK.
- [ ] **Étape 5 : commit** `feat(online): vue de jeu minimale en direct`

### Tâche 9 : Vérification de bout en bout

**Fichiers :** Créer `scripts/online-check.mjs`, `scripts/seed-online.sql` (4 comptes, un deck importé chacun, en réutilisant le jeu de cartes SVG du deck de test).

- [ ] **Étape 1 :** base locale (migrations 0001–0004), `seed-online.sql`, build, Worker (`npm run game:dev`) et site (`wrangler pages dev`).
- [ ] **Étape 2 :** `node scripts/online-check.mjs http://localhost:8788 <dossier-captures>` déroule le scénario de la spec (Alex crée une table Commander à 3, Bob rejoint par le salon, Chloé par le lien, decks, démarrage, pioche de Bob vue par Alex, aucune entrée de carte de la main de Bob dans les messages WebSocket d'Alex — interceptés via `page.on('websocket')`, rechargement de Chloé, Dan spectateur, Alex passe le tour de Chloé, Bob abandonne, Alex élimine Chloé → « Victoire de Alex », `winner_player_id` en D1).
  Attendu : tous les contrôles ✓, aucune erreur JavaScript, `Tout est OK`.
- [ ] **Étape 3 :** en cas d'échec, `systematic-debugging`, corriger, relancer. Envoyer 3 captures à l'utilisateur.
- [ ] **Étape 4 : commit et push** `test(online): partie en ligne vérifiée de bout en bout`

### Tâche 10 : Déploiement automatique et documentation

**Fichiers :** Créer `.github/workflows/deploy-game-worker.yml`, `docs/deploiement-jeu-en-ligne.md` ; Modifier `docs/superpowers/roadmap.md`, `README.md` (section développement local).

- [ ] **Étape 1 :** Action : déclencheurs `push` sur `main` (chemins `workers/**`, `lib/game/**`, `lib/db-games.ts`, `migrations/**`) et `workflow_dispatch` ; étapes `actions/checkout@v4`, `actions/setup-node@v4` (Node 22), `npm ci`, `npm test`, `npx wrangler d1 migrations apply dc-league --remote`, `npx wrangler deploy` (dossier `workers/game`) ; variables `CLOUDFLARE_API_TOKEN` et `CLOUDFLARE_ACCOUNT_ID` depuis les secrets.
- [ ] **Étape 2 :** `docs/deploiement-jeu-en-ligne.md` : étapes depuis un téléphone pour créer le jeton (modèle « Edit Cloudflare Workers » + droit D1 Edit), trouver l'identifiant de compte, ajouter les deux secrets GitHub, lancer l'Action à la main la première fois, puis relancer le déploiement du site Pages ; vérifications après déploiement.
- [ ] **Étape 3 : vérifier** la syntaxe YAML (`npx --yes yaml-lint .github/workflows/deploy-game-worker.yml` ou équivalent) ; `npm test` → PASS.
- [ ] **Étape 4 :** feuille de route : sous-projet 2 terminé, vérifications post-déploiement ajoutées.
- [ ] **Étape 5 : commit et push** `ci(online): déploiement automatique du Worker de jeu`
