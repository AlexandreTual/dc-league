# Design — Système de ligues avec historique

**Date :** 2026-04-30  
**Statut :** Approuvé  

---

## Contexte

L'application gère actuellement une seule ligue active (round-robin + playoffs) pour un groupe d'amis jouant au Duel Commander. Il n'existe aucun moyen de conserver les résultats des saisons passées. L'objectif est d'ajouter un système d'historique permettant d'archiver les ligues terminées et d'en démarrer de nouvelles, tout en conservant le lien vers le deck commandant de chaque joueur par saison.

---

## Modèle de données

### Nouvelle table : `leagues`

```sql
CREATE TABLE leagues (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,          -- ex: "Saison 1"
  started_at  TEXT NOT NULL,          -- datetime ISO
  ended_at    TEXT,                   -- NULL tant qu'active
  is_active   INTEGER DEFAULT 1       -- 1 = ligue en cours
);
```

### Nouvelle table : `league_players`

Remplace le champ `moxfield_url` sur `players`. Stocke le deck et l'image du commandant par joueur par ligue.

```sql
CREATE TABLE league_players (
  league_id           TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_id           TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  moxfield_url        TEXT,
  commander_image_url TEXT,           -- ex: https://assets.moxfield.net/cards/card-kpvQd-normal.webp
  PRIMARY KEY (league_id, player_id)
);
```

### Table `players` — modification

Suppression du champ `moxfield_url` (déplacé dans `league_players`).

```sql
-- Avant
players: id, name, moxfield_url, avatar_url, created_at

-- Après
players: id, name, avatar_url, created_at
```

### Tables `matches` et `playoffs` — modification

Ajout d'un champ `league_id` NOT NULL sur chaque table.

```sql
ALTER TABLE matches  ADD COLUMN league_id TEXT NOT NULL REFERENCES leagues(id);
ALTER TABLE playoffs ADD COLUMN league_id TEXT NOT NULL REFERENCES leagues(id);
```

---

## Flux admin

### Démarrer une nouvelle ligue

1. L'admin clique sur "Nouvelle saison"
2. Saisit le nom (ex : "Saison 2")
3. La ligue est créée avec `started_at = now()` et `is_active = 1`
4. L'admin ajoute des joueurs à cette ligue avec `moxfield_url` + `commander_image_url`
5. Génère les matchs round-robin → saisit les scores → génère les playoffs

### Clôturer une ligue

1. L'admin clique sur "Clôturer la saison" (disponible quand la finale est jouée)
2. La ligue passe à `is_active = 0`, `ended_at = now()`
3. Le dashboard invite à créer une nouvelle saison

### Contraintes

- Une seule ligue peut être active à la fois
- On ne peut pas clôturer une ligue si des matchs round-robin non complétés existent, ou si des playoffs ont été générés mais ne sont pas tous complétés
- On ne peut pas créer une nouvelle ligue si une ligue active existe déjà

### Migration des données existantes

Si une base `local.db` contient déjà des données (joueurs, matchs sans `league_id`), le démarrage de l'app crée automatiquement une ligue "Saison 1" active et y rattache toutes les données existantes. Les joueurs existants conservent leur `moxfield_url` actuel comme valeur initiale dans `league_players`.

---

## Affichage de la carte commandant

- **Desktop** : tooltip au survol du nom du joueur (image `commander_image_url`)
- **Mobile** : tap sur le nom pour afficher/masquer la carte
- Présent sur : leaderboard (page d'accueil), matchs (calendrier), page historique

Le composant est réutilisable (`PlayerName`) — reçoit `name`, `commander_image_url` et affiche le tooltip.

---

## Page historique (publique — `/history`)

- Liste des ligues archivées triées par `ended_at` DESC
- Chaque ligne : nom de la saison, date de début → date de fin
- Clic → page de détail `/history/[id]` avec :
  - Classement final (recalculé depuis les matchs de cette ligue)
  - Tous les matchs round-robin par round avec scores
  - Bracket playoff
  - Carte commandant de chaque joueur (tooltip)

---

## Impact sur le code existant

| Fichier | Changement |
|---|---|
| `lib/db.ts` | Toutes les requêtes `matches`/`playoffs` filtrent par `league_id` actif. Nouvelles fonctions pour `leagues` et `league_players`. |
| `lib/leaderboard.ts` | Aucun changement — `computeLeaderboard` et `generateRoundRobinMatches` sont pures, pas de DB. |
| `app/api/players/route.ts` | POST/DELETE acceptent `moxfield_url` + `commander_image_url` via `league_players`. |
| `app/api/matches/*` | Filtrage par ligue active. |
| `app/api/playoffs/*` | Filtrage par ligue active. |
| `app/page.tsx` | Inchangé visuellement — leaderboard de la ligue active. |
| `components/LeaderboardTable.tsx` | Utilise le composant `PlayerName` avec tooltip. |
| `components/MatchCard.tsx` | Utilise le composant `PlayerName` avec tooltip. |
| `next.config.mjs` | Ajouter `assets.moxfield.net` aux domaines d'images autorisés. |

### Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `components/PlayerName.tsx` | Nom du joueur + tooltip carte commandant (hover/tap) |
| `app/history/page.tsx` | Liste des ligues archivées |
| `app/history/[id]/page.tsx` | Détail d'une ligue archivée |
| `app/api/leagues/route.ts` | GET (liste) + POST (créer) |
| `app/api/leagues/[id]/close/route.ts` | POST — clôturer une ligue |

---

## Configuration

`next.config.mjs` — domaines d'images autorisés :

```js
remotePatterns: [
  { protocol: 'https', hostname: '**.moxfield.com' },
  { protocol: 'https', hostname: '**.moxfield.net' },
],
```

---

## Ce qui ne change pas

- Algorithme round-robin (`generateRoundRobinMatches`)
- Calcul du leaderboard (`computeLeaderboard`)
- Système d'authentification admin (cookie)
- UI générale (dark theme, Tailwind)
