# Design — Serveur temps réel et salon

**Date :** 2026-10-04
**Statut :** En relecture
**Projet :** multijoueur en ligne, sous-projet 2/4 (1. moteur → **2. serveur temps réel et salon** → 3. interface de table → 4. matchs de ligue en ligne)

---

## Contexte

Le sous-projet 1 a livré un moteur pur multijoueur (`lib/game/`) : `GameSetup`, `applyAction`, `canApply`, `viewFor(state, joueur)` (aucune information cachée ne fuit), `GameHistory` (rejeu, annulation de sa propre dernière action). Il reste à faire jouer ce moteur **en ligne** : créer et rejoindre des tables, échanger les actions en direct, garder les parties d'un jour à l'autre.

Le site tourne sur Cloudflare Pages (Next.js 15, `@cloudflare/next-on-pages`, D1). Pages ne peut pas héberger de Durable Object : il faut un Worker séparé, relié au site.

## Objectifs

- Un **salon** listant les tables ouvertes et en cours ; une table se rejoint aussi par **lien**.
- Une **salle d'attente** : places, choix du deck, démarrage par l'hôte.
- Une partie **en direct** pour 2 à 5 joueurs ; chaque joueur ne reçoit **que sa vue** ; des **spectateurs** qui voient l'information publique.
- **Reconnexion** transparente ; partie conservée jusqu'à sa fin, nettoyée après **7 jours** d'inactivité.
- Un **hôte** qui peut démarrer, retirer un joueur avant le début, passer le tour d'un absent ou l'éliminer.
- Une **page de jeu minimale** (texte, listes, quelques boutons) pour vérifier le fonctionnement de bout en bout.
- Déploiement du Worker **automatisé** depuis GitHub (l'utilisateur travaille depuis son téléphone).

## Hors périmètre

Interface de table graphique (sous-projet 3) ; matchs de ligue et score (sous-projet 4) ; chat texte (plus tard, la communication passe par Discord/WhatsApp) ; spectateur qui voit tout.

## Décisions prises avec l'utilisateur

| Sujet | Décision |
|---|---|
| Trouver une table | salon **et** lien d'invitation |
| Durée de vie | conservée jusqu'à la fin, supprimée après 7 jours sans activité |
| Spectateurs | oui, information publique seulement, aucune action |
| Pouvoirs de l'hôte | démarrer, retirer avant le début, passer le tour d'un absent, éliminer un joueur ; rôle transmis si l'hôte est absent |
| Communication | aucune dans l'app pour l'instant |
| Architecture | Durable Object par table, WebSocket via le site (A) ; repli : connexion directe au Worker avec jeton signé (B) |

---

## Architecture

```
navigateur ──HTTP──▶ site Pages (Next.js)  ──D1──▶ game_tables, game_seats, decks…
     │                      │
     └──WebSocket /api/games/<id>/ws ──(vérifie la session)──▶ binding GAME ──▶ Worker dc-league-game
                                                                                └─ GameRoom (1 par table) ──D1 (statut, activité, vainqueur)
```

### 1. Worker `dc-league-game` (`workers/game/`)

- `wrangler.toml` propre : `name = "dc-league-game"`, `workers_dev = false` (aucune adresse publique), Durable Object `GameRoom` (classe SQLite, déclarée par `[[migrations]] new_sqlite_classes = ["GameRoom"]`, disponible dans l'offre gratuite), binding `DB` sur la même base D1, déclencheur planifié quotidien (`crons = ["17 3 * * *"]`).
- `index.ts` : `fetch` délègue à `GameRoom` selon l'id de table ; `scheduled` lance le nettoyage.
- `GameRoom` : enveloppe fine autour de la logique pure `lib/game/room.ts` ; utilise l'API WebSocket **à hibernation** (`ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`) ; chaque socket porte en pièce jointe `{ playerId | null, spectator: boolean }`.
- Stockage du Durable Object : `setup` (GameSetup avec catalogues), actions (une clé par index, `a:000123`), instantané tous les 20 actions, `room` (hôte, présence, dernière activité).
- Réutilise `lib/game/*` tel quel (code pur, sans dépendance Next).

### 2. Site Pages

- `wrangler.toml` du site : `[[durable_objects.bindings]] name = "GAME", class_name = "GameRoom", script_name = "dc-league-game"`.
- `CloudflareEnv` gagne `GAME: DurableObjectNamespace`.

### 3. Données D1 (migration `0004_game_tables.sql`)

```sql
CREATE TABLE IF NOT EXISTS game_tables (
  id                 TEXT PRIMARY KEY,
  host_player_id     TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  format             TEXT NOT NULL CHECK (format IN ('commander', 'duel')),
  seats              INTEGER NOT NULL CHECK (seats BETWEEN 2 AND 5),
  eliminated_see_all INTEGER NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'playing', 'finished')),
  winner_player_id   TEXT REFERENCES players(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  last_activity_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_game_tables_status ON game_tables(status, last_activity_at);

CREATE TABLE IF NOT EXISTS game_seats (
  table_id  TEXT NOT NULL REFERENCES game_tables(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  deck_id   TEXT REFERENCES decks(id) ON DELETE SET NULL,
  seat      INTEGER NOT NULL,
  PRIMARY KEY (table_id, player_id)
);
```

En Duel, `seats` vaut 2. `host_player_id` suit l'hôte courant (mis à jour par `GameRoom` en cas de transmission).

### 4. Fonctions D1 (`lib/db-games.ts`, motif `Result<T>`)

`createTable(db, { hostPlayerId, format, seats, eliminatedSeeAll })`, `listTables(db)` (statuts `open` et `playing`, avec noms des joueurs), `getTable(db, id)` (avec places, decks), `joinTable(db, id, playerId)`, `leaveTable(db, id, playerId)`, `removeSeat(db, id, hostId, playerId)`, `chooseDeck(db, id, playerId, deckId)` (le deck doit appartenir au joueur), `markPlaying(db, id)`, `touchActivity(db, id, now)`, `finishTable(db, id, winnerPlayerId | null)`, `setHost(db, id, playerId)`, `staleTables(db, before)`, `deleteTable(db, id)`.

Messages d'erreur en français : « Table introuvable », « Table complète », « La partie a déjà commencé », « Ce deck n'est pas à toi », « Seul l'hôte peut faire ça », « Il faut au moins 2 joueurs », « En Duel, il faut exactement 2 joueurs », « Chaque joueur doit choisir un deck ».

### 5. Routes (`app/api/games/…`, `requirePlayer` + `assertSameOrigin` sur les écritures)

| Méthode | Route | Effet |
|---|---|---|
| GET | `/api/games` | liste du salon |
| POST | `/api/games` | crée une table (l'hôte occupe la place 1) |
| GET | `/api/games/[id]` | détail de la salle d'attente |
| POST | `/api/games/[id]/join` | rejoindre |
| POST | `/api/games/[id]/leave` | partir (avant le départ) |
| POST | `/api/games/[id]/deck` | choisir son deck |
| POST | `/api/games/[id]/kick` | l'hôte retire un joueur (avant le départ) |
| POST | `/api/games/[id]/start` | l'hôte démarre : construit les catalogues (`buildCatalog` sur les decks choisis), appelle `GameRoom` `/init` avec le `GameSetup`, puis `markPlaying` |
| GET | `/api/games/[id]/ws` | WebSocket : vérifie session et origine, transmet la requête à `GameRoom` avec l'en-tête interne `X-Player-Id` (ou spectateur) |

Le site retire tout en-tête `X-Player-Id` venu du navigateur avant de transmettre ; seul le site le pose.

### 6. Pages

- `/salon` : tables `open` (format, places occupées/total, hôte, bouton « Rejoindre ») et `playing` (bouton « Regarder ») ; formulaire « Créer une table ».
- `/tables/[id]` :
  - `open` : places, sélecteur de deck (ses decks importés), bouton « Copier le lien », « Partir » ; pour l'hôte : « Retirer », « Démarrer » (désactivé avec la raison tant que les conditions ne sont pas remplies). Rafraîchie toutes les 3 s (pas de WebSocket avant le départ).
  - `playing` / `finished` : **vue de jeu minimale** connectée en WebSocket : joueurs (PV, poison, cartes en main, bibliothèque), zones publiques en listes de noms, ma main, journal, et boutons Garder, Mulligan, Piocher, Fin du tour, Annuler, Abandonner ; pour l'hôte : « Passer le tour de X », « Éliminer X », « Clore la partie ». Bandeau « Reconnexion… » si la connexion tombe.
- Lien « Salon » dans la navigation, visible pour un joueur connecté.

---

## Logique de table (`lib/game/room.ts`, pure)

```ts
type Seat = { playerId: string; name: string }
type RoomState = {
  tableId: string
  hostId: string
  seats: Seat[]                       // ordre des places
  history: GameHistory
  online: Record<string, number>      // playerId → nombre de sockets ouvertes
  absentSince: Record<string, number> // playerId → instant de déconnexion (ms)
  finished: boolean
  winner: string | null
}

type ClientMessage =
  | { type: 'action'; action: ClientAction }      // GameAction sans actor ni seed
  | { type: 'undo' }
  | { type: 'concede' }
  | { type: 'host'; op: 'passTurn' | 'eliminate'; target: string }
  | { type: 'host'; op: 'close' }

type ServerMessage =
  | { type: 'view'; view: PlayerView; cards: CardDataMap; host: string; online: string[]; finished: boolean; winner: string | null }
  | { type: 'rejected'; error: string }

type CardDataMap = Record<string, Record<number, CatalogEntry>>  // propriétaire → ref → données

type Outbox = { to: string | 'spectators' | 'all'; message: ServerMessage }[]

handleMessage(room, from: { playerId: string | null }, msg: ClientMessage, ctx: { now: number; seed: () => number }): { room; outbox; changed: boolean }
handleConnect(room, from, now): { room; outbox }
handleDisconnect(room, from, now): { room; outbox }
viewMessageFor(room, viewer: string | null, alreadySent: CardDataMap): ServerMessage
```

Règles :

- **Auteur imposé** : `actor` = `from.playerId` ; un spectateur (`playerId` nul ou hors des places) reçoit « Les spectateurs ne peuvent pas jouer ».
- **Graines** : le serveur remplit `seed` pour `mulligan`, `shuffle`, `endLook` (si `shuffle`) ; la valeur envoyée par le navigateur est ignorée. `start` est joué par `/init` avec une graine du serveur.
- **Validation** : `history.push` (donc `canApply`) ; refus → `rejected` à l'auteur seul, état inchangé.
- **Annuler** : `history.undo(playerId)` ; sinon « Rien à annuler ».
- **Abandonner** : action `eliminate` du joueur sur lui-même.
- **Hôte** : `passTurn` → `endTurn` joué au nom du joueur actif `target` (refusé si `target` n'est pas le joueur actif) ; `eliminate` → `eliminate` joué par l'hôte ; `close` → `finished = true`, sans vainqueur ; un non-hôte reçoit « Seul l'hôte peut faire ça ».
- **Transmission d'hôte** : à chaque message ou connexion, si l'hôte est absent depuis plus de **5 minutes**, l'hôte devient le premier joueur connecté suivant dans l'ordre des places ; pas de retour automatique.
- **Fin** : après chaque action, s'il ne reste qu'un joueur non éliminé (et au moins 2 joueurs au départ), `finished = true`, `winner` = ce joueur. Une partie finie refuse toute action (« La partie est terminée »).
- **Diffusion** : après tout changement, chaque socket reçoit `view` calculée pour son joueur (`viewFor(state, playerId)` ; spectateur : `viewFor(state, '')`, qui ne voit que le public), avec `canUndo` de `history.canUndo`.
- **Spectateurs et révélations** : le moteur ne connaît que les joueurs ; une carte de main révélée « à tous » n'est donc pas montrée aux spectateurs (limite acceptée).
- **Données de cartes** : `cards` ne contient que les entrées `(propriétaire, ref)` des cartes **visibles** dans cette vue et pas encore envoyées à cette socket ; à la connexion, toutes celles visibles. Aucune entrée de carte jamais visible n'est envoyée.

## Durable Object `GameRoom`

- `POST /init` (appelé par le site seulement) : refuse si déjà initialisé ; enregistre `setup`, joue `start`.
- `GET /ws` (upgrade) : lit `X-Player-Id` / spectateur, accepte la socket (hibernation), envoie la vue complète.
- Messages : taille max **16 Ko**, JSON invalide ignoré, au-delà de **20 messages/s** par socket les suivants sont ignorés.
- Persistance : chaque action acceptée est écrite (`a:<index>`) **avant** la diffusion ; si l'écriture échoue, l'action est retirée de l'historique et l'auteur reçoit « Réessaie ». Annuler supprime la dernière clé.
- Au réveil (hibernation, redémarrage) : recharge `setup`, dernier instantané et actions suivantes.
- D1 : `touchActivity` au plus une fois par minute ; `finishTable` à la fin ; `setHost` à la transmission.
- `DELETE` (nettoyage) : `ctx.storage.deleteAll()` et fermeture des sockets.

## Nettoyage quotidien

`scheduled` du Worker : `staleTables(db, maintenant − 7 jours)` (tous statuts) → pour chacune, `DELETE` sur son `GameRoom` puis `deleteTable`.

## Repli B (si la tâche de vérification échoue)

Si le site ne peut pas transmettre la WebSocket à `GameRoom` : le Worker reçoit une route publique `/ws/<id>?t=<jeton>` ; le site délivre (`GET /api/games/[id]/ticket`) un jeton HMAC (secret partagé `GAME_TICKET_SECRET`) valable 60 s contenant table, joueur et expiration ; le Worker vérifie le jeton et l'origine. Le reste de la conception est inchangé.

---

## Déploiement

- **GitHub Action** `.github/workflows/deploy-game-worker.yml` : sur `push` vers `main` touchant `workers/**`, `lib/game/**` ou `migrations/**` (et à la demande) : `npm ci`, tests, `wrangler d1 migrations apply dc-league --remote`, `wrangler deploy` dans `workers/game`.
- Secrets GitHub à créer une fois par l'utilisateur : `CLOUDFLARE_API_TOKEN` (droits Workers Scripts, D1, Durable Objects) et `CLOUDFLARE_ACCOUNT_ID` ; la spec du plan donnera les étapes depuis un téléphone.
- Le Worker doit être déployé **avant** le site qui y fait référence (l'Action tourne sur la fusion ; le site Pages se reconstruit en parallèle : le premier déploiement du site peut échouer à la liaison et se relance après celui du Worker).

## Développement local

`wrangler dev` dans `workers/game` (port 8787) et `wrangler pages dev` pour le site : la liaison `script_name` se résout par le registre local de Wrangler. Base D1 locale commune via `--persist-to` sur le même dossier.

---

## Tests

- **`lib/game/room.test.ts`** : auteur imposé ; action au nom d'un autre impossible ; spectateur refusé ; graines du serveur (une graine du navigateur est ignorée) ; refus → `rejected` à l'auteur seul ; annuler ; abandonner ; hôte : passer le tour du joueur actif, refus sur un autre, éliminer, clore, refus pour un non-hôte ; transmission de l'hôte après 5 min (et pas avant) ; fin de partie avec vainqueur, action refusée ensuite ; **anti-fuite** : 4 joueurs et 1 spectateur, 200 actions aléatoires, aucune entrée de `cards` ni aucun identifiant de carte invisible dans les messages reçus par chacun ; données de cartes envoyées une seule fois par socket.
- **`lib/db-games.test.ts`** : créer, lister, rejoindre (table complète, déjà commencée), partir, retirer (hôte seulement), choisir un deck (pas le sien → refus), conditions de départ (Duel = 2), activité, fin, transmission d'hôte, tables périmées, suppression en cascade.
- **Routes** : tests des routes de salle d'attente et de `start` (avec un faux binding `GAME`).
- **`GameRoom`** : test de persistance avec un stockage en mémoire (actions écrites avant diffusion, rechargement identique après « réveil », échec d'écriture → action retirée).
- **De bout en bout** (`scripts/online-check.mjs`, Playwright) : Worker et site locaux ; 3 comptes dans 3 contextes de navigateur ; Alex crée une table Commander à 3, Bob rejoint par le salon, Chloé par le lien ; chacun choisit un deck ; Alex démarre ; tous voient la partie ; Bob pioche et Alex le voit en direct (nombre de cartes) ; aucune donnée des cartes de la main de Bob dans les messages reçus par Alex ; Chloé recharge et retrouve la partie ; un 4e compte regarde en spectateur ; Alex passe le tour de Chloé ; Bob abandonne, puis Alex élimine Chloé → partie terminée, vainqueur Alex en D1.

## Fichiers

- Créer : `workers/game/{wrangler.toml,index.ts,room-do.ts}`, `lib/game/room.ts`, `lib/game/room.test.ts`, `lib/db-games.ts`, `lib/db-games.test.ts`, `migrations/0004_game_tables.sql`, `app/api/games/**`, `app/salon/page.tsx`, `app/tables/[id]/page.tsx`, `components/online/*`, `scripts/online-check.mjs`, `.github/workflows/deploy-game-worker.yml`.
- Modifier : `wrangler.toml` (binding `GAME`), `env.d.ts` / types Cloudflare, navigation, `test/d1.ts` (migration 0004), `docs/superpowers/roadmap.md`.
