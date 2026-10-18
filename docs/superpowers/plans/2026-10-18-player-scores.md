# Scores saisis par les joueurs — plan d'implémentation

> **Pour les agents :** une issue GitHub par tâche ; lire `CLAUDE.md`, la spec, puis la tâche. Les étapes utilisent des cases à cocher (`- [ ]`). Tests d'abord.

**Objectif :** chaque joueur d'un match de ligue (round-robin et playoffs) saisit et corrige son score, en indiquant « en physique » ou « en ligne » ; l'adversaire est prévenu sur le site ; chaque match garde le deck joué ; le classement départage les égalités.

**Architecture :** l'écriture d'un score passe par une seule fonction de base (`recordScore`) qui enregistre en un `batch` le score, l'auteur, le mode, la pastille, le deck figé et une ligne de journal. Les droits restent dans `lib/leagues/` (nouvelle règle « joueur du match »). Le départage est pur, dans `lib/leaderboard.ts`. L'interface réutilise `ScoreModal` et `MatchCard`.

**Stack :** Next.js 15 (edge, Cloudflare Pages), D1, Vitest (`test/d1.ts`), playwright-core.

**Spec :** `docs/superpowers/specs/2026-10-18-player-scores-design.md` (issue #124, chantier #117).

## Contraintes globales

- Interface, messages d'erreur, commits et PR en français ; commits `type(portée): résumé`.
- Migration `0018_player_scores.sql` ajoutée à `MIGRATIONS` dans `test/d1.ts`, appliquée en production à la fusion. Pendant une à deux minutes, le site peut tourner sur l'ancienne base : les lectures se replient sur le deck inscrit et n'affichent ni auteur ni mode ; une saisie échoue proprement (« Réessaie dans un instant. »), jamais de plantage ni de perte.
- Ligue close : toute écriture refusée (`ERREURS_LIGUE.leagueClosed`), comme aujourd'hui.
- Ligue privée : un non-membre reçoit 404 « … introuvable. », jamais 403.
- Chaque tâche se termine par `npm test`, `npx tsc --noEmit` et `npx @cloudflare/next-on-pages` verts.

## Ordre et dépendances

| Tâche | Dépend de |
|---|---|
| 1. Données : saisie enregistrée, journal, pastille, deck figé | — |
| 2. Droits et routes API | 1 |
| 3. Départage des égalités | — (indépendante) |
| 4. Interface : saisie par les joueurs, pastilles, « Gérer » | 1, 2 |
| 5. Vérification navigateur et documentation | 1 à 4 |

---

### Tâche 1 : données — saisie enregistrée, journal, pastille, deck figé

**Fichiers :**
- Créer : `migrations/0018_player_scores.sql`, `lib/db-scores.ts`, `lib/db-scores.test.ts`
- Modifier : `test/d1.ts` (MIGRATIONS), `lib/db.ts` (`updateMatchScore`, `updatePlayoffScore` délèguent à `recordScore` ; types `DbMatch`, `DbPlayoff`), `lib/db-stats.ts` (deck figé), lectures de ligue qui montrent un deck par match

**Interfaces produites :**
```ts
// lib/db-scores.ts
export type PlayedMode = 'physical' | 'online'
export type ScoreAuthor = { userId: string; playerId: string | null }   // playerId : null si l'auteur n'est pas joueur du match
export type ItemKind = 'match' | 'playoff'
recordScore(db, kind: ItemKind, id: string, score: { s1: number; s2: number; mode: PlayedMode }, author: ScoreAuthor): Promise<Result<…>>
markSeen(db, leagueId: string, playerId: string, kind: ItemKind): Promise<Result<number>>   // nombre de matchs marqués vus
listScoreEntries(db, kind: ItemKind, id: string): Promise<Result<ScoreEntry[]>>
listDisputedIds(db, leagueId: string): Promise<Result<{ kind: ItemKind; id: string }[]>>   // saisis par les deux joueurs, valeurs différentes
countUnseen(db, leagueId: string, playerId: string): Promise<Result<{ match: number; playoff: number }>>
// DbMatch / DbPlayoff gagnent (facultatifs) : played_mode, scored_by_player_id, scored_at, unseen_by, deck1_*, deck2_*
```

- [ ] **Étape 1 : migration**

```sql
-- Scores saisis par les joueurs (spec 2026-10-18-player-scores-design).
ALTER TABLE matches ADD COLUMN played_mode TEXT CHECK (played_mode IN ('physical', 'online'));
ALTER TABLE matches ADD COLUMN scored_by_player_id TEXT REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE matches ADD COLUMN scored_at TEXT;
ALTER TABLE matches ADD COLUMN unseen_by TEXT CHECK (unseen_by IN ('p1', 'p2', 'both'));
ALTER TABLE matches ADD COLUMN deck1_id TEXT;
ALTER TABLE matches ADD COLUMN deck1_name TEXT;
ALTER TABLE matches ADD COLUMN deck1_image TEXT;
ALTER TABLE matches ADD COLUMN deck2_id TEXT;
ALTER TABLE matches ADD COLUMN deck2_name TEXT;
ALTER TABLE matches ADD COLUMN deck2_image TEXT;
-- (mêmes colonnes sur playoffs)
CREATE TABLE IF NOT EXISTS score_entries (
  id          TEXT PRIMARY KEY,
  league_id   TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  item_kind   TEXT NOT NULL CHECK (item_kind IN ('match', 'playoff')),
  item_id     TEXT NOT NULL,
  user_id     TEXT,
  player_id   TEXT,
  score_p1    INTEGER NOT NULL,
  score_p2    INTEGER NOT NULL,
  played_mode TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_score_entries_item ON score_entries(item_kind, item_id);
-- Matchs déjà joués : deck inscrit actuel (meilleure information disponible).
UPDATE matches SET deck1_id = (SELECT lp.deck_id FROM league_players lp WHERE lp.league_id = matches.league_id AND lp.player_id = matches.player1_id), … WHERE is_completed = 1;
```
La version finale remplit aussi nom et image depuis `decks`, et fait de même pour `playoffs`. Vérifier qu'une ligue supprimée efface bien son journal (`ON DELETE CASCADE` ou suppression explicite là où la ligue est supprimée).

- [ ] **Étape 2 : tests (`lib/db-scores.test.ts`) qui échouent**
  - saisie par le joueur 1 : score écrit, `played_mode`, `scored_by_player_id = p1`, `unseen_by = 'p2'`, une ligne de journal ;
  - correction par le joueur 2 : `unseen_by = 'p1'`, deux lignes de journal ;
  - saisie par un organisateur non joueur : `scored_by_player_id` NULL, `unseen_by = 'both'` ;
  - deck figé : changer le deck inscrit après la saisie ne change pas `deck1_name` ; une nouvelle saisie fige le nouveau deck ;
  - `markSeen` ne touche que les matchs où l'appelant est attendu (`both` → reste l'autre joueur) ;
  - `listDisputedIds` : les deux joueurs ont saisi des scores différents → listé ; même score ou un seul auteur → non ;
  - ligue close : refus, rien dans le journal ; playoffs : avancement en finale inchangé (tests existants verts) ;
  - effacer un score (`resetMatchScore`) remet `unseen_by` et le mode à NULL, garde le journal.
- [ ] **Étape 3 : implémenter** `recordScore` (un `batch` : score + colonnes + journal, conditionné à la ligue ouverte), brancher `updateMatchScore` et `updatePlayoffScore` dessus (la logique de finale reste), `markSeen`, `listScoreEntries`, `listDisputedIds`, `countUnseen`.
- [ ] **Étape 4 : deck figé à la lecture.** `listMatchStats` (`lib/db-stats.ts`) et les lectures de ligue prennent `COALESCE(m.deck1_name, d1.name)` (idem image, identifiant) : le deck figé d'abord, le deck inscrit en repli. Test : stats d'un joueur qui a changé de deck après deux matchs.
- [ ] **Étape 5 : vérifications et commit** `feat(ligues): scores enregistrés avec auteur, mode, journal et deck figé`.

---

### Tâche 2 : droits et routes API

**Fichiers :**
- Modifier : `lib/leagues/item-access.ts`, `app/api/matches/[id]/route.ts`, `app/api/playoffs/[id]/route.ts`
- Créer : `app/api/leagues/[id]/seen/route.ts`, tests des routes (à côté des tests existants des routes de ligue)

**Interfaces produites :**
```ts
// lib/leagues/item-access.ts
/** Saisir ou corriger : gérer la ligue, ou être joueur du match dans une ligue visible. */
scoreAccess(db, table: 'matches' | 'playoffs', id, user): Promise<{ author: ScoreAuthor } | NextResponse>
refuseItemScore(...)   // inchangé : effacer reste « gérer la ligue »
```

- [ ] **Étape 1 : tests qui échouent** — `PATCH /api/matches/[id]` : joueur 1 et joueur 2 du match → 200 ; autre inscrit → 403 « Seuls les joueurs du match et l'organisateur peuvent saisir ce score. » ; visiteur → 401 ; ligue privée et non membre → 404 ; organisateur et admin → 200 ; compte de démarrage → refus ; mode absent ou invalide → 400 « Indique si le match s'est joué en physique ou en ligne. » ; ligue close → 409. `DELETE` par un joueur du match → 403, par l'organisateur → 200. Mêmes cas pour `/api/playoffs/[id]` (sans 1-1). `POST /api/leagues/[id]/seen` `{ kind }` : marque les matchs vus pour l'appelant, 401 pour un visiteur.
- [ ] **Étape 2 : implémenter** `scoreAccess` (lit le match, sa ligue, vérifie visibilité avec `leagueFor(..., 'view')`, puis joueur du match ou `canManageLeague`) ; les routes passent `{ score_p1, score_p2, played_mode }` et l'auteur à `recordScore`. Colonne manquante (base pas encore migrée) → 503 « Réessaie dans un instant. ».
- [ ] **Étape 3 : vérifications et commit** `feat(ligues): les joueurs d'un match saisissent et corrigent son score`.

---

### Tâche 3 : départage des égalités (indépendante)

**Fichiers :** `lib/leaderboard.ts`, `lib/leaderboard.test.ts` ; appelants de `computeLeaderboard` (passer l'identifiant de la ligue).

**Interface :** `computeLeaderboard(players, matches, leagueId: string): PlayerStats[]`

- [ ] **Étape 1 : tests qui échouent** — deux joueurs à égalité parfaite, l'un a gagné leur match → devant ; leur match nul ou non joué → ordre du tirage fixe, identique à chaque appel et indépendant de l'ordre d'entrée des joueurs ; trois joueurs à égalité → mini-classement aux points sur leurs seuls matchs entre eux, puis tirage fixe pour ceux qui restent à égalité ; ligue différente → tirage différent possible ; critères existants (points, différence, victoires) inchangés.
- [ ] **Étape 2 : implémenter** : trier par points, différence, victoires ; regrouper les égalités ; dans chaque groupe, mini-classement aux points sur les matchs internes ; puis clé de tirage = petite empreinte (par ex. FNV-1a) de `leagueId + ':' + playerId`.
- [ ] **Étape 3 : note sous le classement** (`/ligues/<id>/classement`) : « À égalité : confrontation directe, puis tirage au sort. »
- [ ] **Étape 4 : vérifications et commit** `feat(ligues): départage des égalités par confrontation directe puis tirage fixe`. Fermer #51 avec la PR (`Closes #51` en plus de l'issue de la tâche).

---

### Tâche 4 : interface — saisie par les joueurs, pastilles, « Gérer »

**Fichiers :**
- Modifier : `components/ScoreModal.tsx` (choix « En physique / En ligne »), `components/MatchCard.tsx` (« Saisi par Ana · en physique », pastille « À vérifier »), `app/ligues/[id]/calendrier/page.tsx`, `app/ligues/[id]/playoffs/page.tsx` et `PlayoffBracket.tsx`, `components/LeagueTabs.tsx` et `lib/nav.ts` (pastille sur l'onglet), `components/admin/RoundRobinPanel.tsx` et `PlayoffsPanel.tsx` (badge « Scores différents », journal dépliable, mode dans la saisie de l'organisateur)
- Créer : composant client pour le bouton « Saisir le score / Corriger » des pages publiques (la page reste rendue côté serveur) et petit composant qui appelle `POST /api/leagues/[id]/seen` à l'ouverture

- [ ] **Étape 1 : tests** des fonctions pures ajoutées (libellé « Saisi par … / Corrigé par … », qui voit le bouton, qui voit la pastille), dans `lib/` ou à côté des composants.
- [ ] **Étape 2 : implémenter.** Le bouton n'apparaît que sur les matchs de l'utilisateur connecté (ou pour l'organisateur), ligue ouverte. Après saisie : `router.refresh()`. Pastille d'onglet calculée côté serveur (`countUnseen`), effacée à l'ouverture de l'onglet. Champs nouveaux absents (ancienne base) : rien d'affiché.
- [ ] **Étape 3 : téléphone** : boutons de 44 px, fenêtre lisible à 375 px.
- [ ] **Étape 4 : vérifications et commit** `feat(ligues): saisie du score par les joueurs depuis le calendrier et les playoffs`.

---

### Tâche 5 : vérification navigateur et documentation

**Fichiers :** créer `scripts/scores-check.mjs` ; modifier `CLAUDE.md` (liste des scripts), `docs/superpowers/roadmap.md` (partie 2 faite), éventuellement `scripts/seed-online.mjs` (matchs générés pour `league-e2e`).

- [ ] **Étape 1 : script** — Ana (e2e-1) saisit 2-1 en physique sur son match contre Bastien ; Bastien voit la pastille sur l'onglet et le match, elle disparaît à l'ouverture ; Bastien corrige en 1-2 en ligne ; l'organisateur (ou un admin, la ligue e2e n'ayant pas d'organisateur) voit « Scores différents » et le journal ; Chloé ne voit pas de bouton sur ce match et l'API lui répond 403 ; classement à jour ; playoffs : un joueur saisit sa demi-finale, la finale se remplit ; téléphone 375 × 812 ; aucune erreur JavaScript.
- [ ] **Étape 2 : passer aussi** `leagues-check`, `home-nav-check`, `admin-games-check`.
- [ ] **Étape 3 : documentation** et commit `docs(ligues): scores saisis par les joueurs vérifiés, feuille de route`.
