# Ligues créées par les joueurs — plan d'implémentation

> **Pour les agents :** sous-skill requis : superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans, tâche par tâche. Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** permettre à tout compte joueur de créer une ligue (publique ou privée), d'y faire entrer des joueurs (ajout direct ou lien d'invitation) et de la gérer, plusieurs ligues tournant en parallèle.

**Architecture :** les droits tiennent dans un module pur (`lib/leagues/access.ts`) appelé par toutes les pages et routes. Les routes qui lisaient « la ligue active » prennent l'identifiant de la ligue. Les pages Ligue passent sous `/ligues/[id]/…`, et les anciennes adresses redirigent vers la ligue mise en avant.

**Stack :** Next.js 15 (edge, Cloudflare Pages), D1, Vitest (`test/d1.ts`), playwright-core pour les scripts navigateur.

**Spec :** `docs/superpowers/specs/2026-10-12-user-leagues-design.md`

## Contraintes globales

- Interface, messages d'erreur, commits et PR en français ; commits `type(portée): résumé`.
- Migration `0013_user_leagues.sql` ajoutée à `MIGRATIONS` dans `test/d1.ts` ; appliquée en production à la fusion. Le code tolère une ou deux minutes sur l'ancienne base : au pire une erreur de chargement propre (`LoadError`), jamais de plantage ni de donnée perdue.
- Ligue privée invisible : 404 « Ligue introuvable. », jamais 403, pour ne pas révéler son existence.
- Rejoindre, s'inscrire ou se désinscrire est refusé une fois les matchs générés (« Les matchs ont déjà été générés… »).
- Chaque tâche se termine par `npm test`, `npx tsc --noEmit` et `npx @cloudflare/next-on-pages` verts.

---

### Tâche 1 : données et droits

**Fichiers :**
- Créer : `migrations/0013_user_leagues.sql`, `lib/leagues/access.ts`, `lib/leagues/access.test.ts`, `lib/db-leagues.user.test.ts`
- Modifier : `test/d1.ts` (MIGRATIONS), `lib/db-leagues.ts`

**Interfaces produites :**
```ts
// lib/db-leagues.ts
export type LeagueVisibility = 'public' | 'private'
export type DbLeague = { id; name; started_at; ended_at; is_active; owner_player_id: string | null; visibility: LeagueVisibility; owner_name: string | null }
createLeague(db, { name, ownerPlayerId: string | null, visibility }): Promise<Result<DbLeague>>   // plus de limite « une active »
getLeague(db, id): Promise<Result<DbLeague | null>>
updateLeague(db, id, { name?, visibility? }): Promise<Result<DbLeague>>
isLeagueMember(db, leagueId, playerId): Promise<Result<boolean>>
listLeaguesFor(db, viewer: Viewer): Promise<Result<DbLeague[]>>        // visibles par viewer, triées started_at DESC
listMyLeagueIds(db, playerId): Promise<Result<string[]>>               // inscrit ou organisateur
getFeaturedLeague(db, viewer: Viewer): Promise<Result<DbLeague | null>>
renewInviteToken(db, leagueId): Promise<Result<string>>
getLeagueByInviteToken(db, token): Promise<Result<DbLeague | null>>
countScoredMatches(db, leagueId): Promise<Result<number>>
// lib/leagues/access.ts
export type Viewer = { playerId: string; isAdmin: boolean } | null
canViewLeague(league: Pick<DbLeague,'visibility'|'owner_player_id'>, viewer: Viewer, isMember: boolean): boolean
canManageLeague(league: Pick<DbLeague,'owner_player_id'>, viewer: Viewer): boolean
viewerOf(user: CurrentUser | null): Viewer   // session de démarrage = admin
```

- [ ] **Étape 1 : migration**

```sql
-- Plusieurs ligues en parallèle, créées par les joueurs (spec 2026-10-12-user-leagues-design).
-- Ligues existantes : publiques, sans organisateur (gérées par les admins).
ALTER TABLE leagues ADD COLUMN owner_player_id TEXT REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE leagues ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private'));
ALTER TABLE leagues ADD COLUMN invite_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_invite ON leagues(invite_token);
CREATE INDEX IF NOT EXISTS idx_leagues_owner ON leagues(owner_player_id);
CREATE INDEX IF NOT EXISTS idx_league_players_player ON league_players(player_id);
```

Ajouter `'0013_user_leagues.sql'` à `MIGRATIONS`.

- [ ] **Étape 2 : tests de `access.ts`** : les cas visiteur, joueur non inscrit, inscrit, organisateur et admin, sur une ligue publique puis privée (vue) ; gestion par l'organisateur et l'admin seulement ; une ligue sans organisateur n'est gérable que par l'admin.

```ts
import { describe, it, expect } from 'vitest'
import { canViewLeague, canManageLeague, viewerOf } from './access'

const pub = { visibility: 'public' as const, owner_player_id: 'org' }
const priv = { visibility: 'private' as const, owner_player_id: 'org' }
const joueur = { playerId: 'p', isAdmin: false }
const orga = { playerId: 'org', isAdmin: false }
const admin = { playerId: 'a', isAdmin: true }

describe('canViewLeague', () => {
  it('publique : tout le monde', () => {
    expect(canViewLeague(pub, null, false)).toBe(true)
    expect(canViewLeague(pub, joueur, false)).toBe(true)
  })
  it('privée : inscrits, organisateur et admin seulement', () => {
    expect(canViewLeague(priv, null, false)).toBe(false)
    expect(canViewLeague(priv, joueur, false)).toBe(false)
    expect(canViewLeague(priv, joueur, true)).toBe(true)
    expect(canViewLeague(priv, orga, false)).toBe(true)
    expect(canViewLeague(priv, admin, false)).toBe(true)
  })
})

describe('canManageLeague', () => {
  it('organisateur et admin', () => {
    expect(canManageLeague(pub, orga)).toBe(true)
    expect(canManageLeague(pub, admin)).toBe(true)
    expect(canManageLeague(pub, joueur)).toBe(false)
    expect(canManageLeague(pub, null)).toBe(false)
  })
  it('ligue sans organisateur : admin seulement', () => {
    expect(canManageLeague({ owner_player_id: null }, joueur)).toBe(false)
    expect(canManageLeague({ owner_player_id: null }, admin)).toBe(true)
  })
})

describe('viewerOf', () => {
  it('visiteur, joueur, session de démarrage', () => {
    expect(viewerOf(null)).toBeNull()
    expect(viewerOf({ playerId: 'p', isAdmin: false, isBootstrap: false } as never)).toEqual({ playerId: 'p', isAdmin: false })
    expect(viewerOf({ playerId: '', isAdmin: false, isBootstrap: true } as never)).toEqual({ playerId: '', isAdmin: true })
  })
})
```

- [ ] **Étape 3 : vérifier l'échec** : `npx vitest run lib/leagues` → échoue, module absent.
- [ ] **Étape 4 : implémenter `access.ts`** (fonctions pures ci-dessus, `viewerOf` traite `isBootstrap` comme admin, comme `checkAccess`).
- [ ] **Étape 5 : tests de `db-leagues.user.test.ts`** :
  - `createLeague` deux fois de suite → deux ligues actives ; `owner_name` renseigné ;
  - `listLeaguesFor(null)` ne renvoie pas une privée ; `listLeaguesFor(inscrit)` la renvoie ; `listLeaguesFor(admin)` renvoie tout ;
  - `getFeaturedLeague` : pour un joueur, sa ligue en cours la plus récente avant une publique plus récente dont il n'est pas membre ; pour un visiteur, la publique en cours la plus récente ; `null` sans ligue en cours ;
  - `renewInviteToken` change le jeton ; l'ancien ne trouve plus rien (`getLeagueByInviteToken` → null) ;
  - `updateLeague` change nom et visibilité ;
  - ligue créée par l'ancien schéma (INSERT sans les nouvelles colonnes) → `visibility = 'public'`, `owner_player_id = null`.
- [ ] **Étape 6 : implémenter dans `db-leagues.ts`.** Toutes les lectures de ligue passent par `LEAGUE_SELECT = 'SELECT l.*, p.name AS owner_name FROM leagues l LEFT JOIN players p ON p.id = l.owner_player_id'`. `normalizeLeague` lit `visibility` (défaut `'public'` si absente), `owner_player_id`, `owner_name`. `listLeaguesFor` filtre en SQL :
  `WHERE ? = 1 OR l.visibility = 'public' OR l.owner_player_id = ? OR EXISTS (SELECT 1 FROM league_players lp WHERE lp.league_id = l.id AND lp.player_id = ?)`. Le jeton : `crypto.randomUUID().replaceAll('-', '')`. `getActiveLeague` est supprimée en tâche 3 (ses appelants migrent) ; ici on la garde.
- [ ] **Étape 7 : `npm test`, `npx tsc --noEmit`** → verts. L'ancien `createLeague(db, name)` est appelé par `app/api/leagues/route.ts` : passer `{ name, ownerPlayerId: null, visibility: 'public' }` pour l'instant.
- [ ] **Étape 8 : commit** `feat(ligues): plusieurs ligues, organisateur, visibilité et lien d'invitation (données)`

---

### Tâche 2 : routes API par ligue, avec les droits

**Fichiers :**
- Créer : `lib/leagues/route-access.ts` (+ test), `app/api/leagues/[id]/invite/route.ts`, `app/api/leagues/join/route.ts`, `app/api/leagues/[id]/matches/route.ts`, `app/api/leagues/[id]/playoffs/route.ts`, `app/api/leagues/route.test.ts`, `app/api/leagues/[id]/players/route.test.ts`, `app/api/matches/[id]/route.test.ts`
- Modifier : `app/api/leagues/route.ts`, `app/api/leagues/[id]/route.ts`, `.../close/route.ts`, `.../players/route.ts`, `.../players/[playerId]/route.ts`, `app/api/matches/[id]/route.ts`, `app/api/playoffs/[id]/route.ts`, `app/api/players/route.ts`, `lib/db.ts` (lecture du `league_id` d'un match/playoff), `components/admin/RoundRobinPanel.tsx`, `components/admin/PlayoffsPanel.tsx`, `app/admin/AdminDashboard.tsx` (nouvelles adresses)
- Supprimer : `app/api/matches/generate/route.ts`, `app/api/playoffs/route.ts`

**Interfaces produites :**
```ts
// lib/leagues/route-access.ts
/** Charge la ligue et vérifie le droit demandé ; renvoie la réponse d'erreur (404/403) sinon. */
leagueFor(db, id: string, user: CurrentUser | null, need: 'view' | 'manage'): Promise<{ league: DbLeague; viewer: Viewer } | NextResponse>
export const LEAGUE_NOT_FOUND = 'Ligue introuvable.'
```

- [ ] **Étape 1 : tests de `leagueFor`** : 404 pour une ligue absente ; 404 pour une privée vue par un non-membre ; 403 « Réservé à l'organisateur de la ligue » pour un membre qui veut gérer ; succès pour l'organisateur et l'admin.
- [ ] **Étape 2 : implémenter `leagueFor`** avec `getLeague`, `isLeagueMember` et `access.ts`.
- [ ] **Étape 3 : tests des routes** (même patron que `app/api/decks/[id]/tokens/route.test.ts` : mock de `@cloudflare/next-on-pages` et de `getCurrentUser`) :
  - `POST /api/leagues` par un joueur → 201, organisateur = joueur, visibilité lue ; visibilité invalide → 400 ; visiteur → 401 ;
  - `GET /api/leagues` sans session → seulement les publiques ;
  - `POST /api/leagues/[id]/players` par un membre non organisateur → 403 ; par l'organisateur → 201 ;
  - `PATCH /api/leagues/[id]/players/[playerId]` : le joueur choisit **son** deck → 200 ; un deck d'un autre joueur → 400 « Ce deck n'appartient pas à ce joueur. » ; un autre joueur → 403 ;
  - `DELETE …/players/[playerId]` par le joueur lui-même avant génération → 200 ; après → 400 ;
  - `POST /api/leagues/join` : bon jeton → 201 et inscrit ; mauvais jeton → 404 « Ce lien d'invitation n'est plus valable. Demande-en un nouveau à l'organisateur. » ; matchs générés → 400 ; ligue archivée → 400 ;
  - `POST /api/leagues/[id]/invite` : organisateur → `{ token }`, deux appels donnent deux jetons différents ;
  - `PATCH /api/matches/[id]` : organisateur de la ligue du match → 200 ; organisateur d'une autre ligue → 403 ;
  - `DELETE /api/leagues/[id]` : organisateur avec un score saisi → 400 « Des scores sont déjà saisis : seul un admin peut supprimer cette ligue. » ; admin → 200.
- [ ] **Étape 4 : implémenter les routes.** Accès `'public'` pour les lectures et `'player'` pour les écritures (la session de démarrage passe par `'admin'` pour les routes de gestion : utiliser `'user'` puis `leagueFor(…,'manage')`, `viewerOf` traitant la session de démarrage comme admin). Le corps de génération du round-robin et des playoffs est repris tel quel des routes supprimées, avec `league.id` au lieu de la ligue active ; la génération refuse une ligue archivée (« Cette ligue est terminée. »). `PATCH /api/leagues/[id]` valide `name` (`requiredText`, `MAX_LENGTH.leagueName`) et `visibility ∈ {public, private}`. `POST /api/players` n'inscrit plus personne.
- [ ] **Étape 5 : adapter les appels de l'interface** : `RoundRobinPanel` et `PlayoffsPanel` reçoivent `leagueId` et appellent `/api/leagues/${leagueId}/matches` et `/api/leagues/${leagueId}/playoffs` ; `AdminDashboard` crée sa ligue avec `{ name, visibility: 'public' }`.
- [ ] **Étape 6 : vérifications** `npm test`, `npx tsc --noEmit`.
- [ ] **Étape 7 : commit** `feat(ligues): routes par ligue réservées à l'organisateur ou à l'admin`

---

### Tâche 3 : pages de ligue sous `/ligues`, anciennes adresses, accueil et navigation

**Fichiers :**
- Créer : `app/ligues/page.tsx` (liste), `app/ligues/[id]/layout.tsx` (garde de visibilité + onglets + en-tête), `app/ligues/[id]/page.tsx` (redirection), `app/ligues/[id]/classement/page.tsx`, `app/ligues/[id]/calendrier/page.tsx`, `app/ligues/[id]/playoffs/page.tsx` (+ `PlayoffBracket.tsx` déplacé), `app/ligues/statistiques/page.tsx`, `lib/leagues/load.ts` (chargement commun : ligue + droit de vue, `notFound()` sinon)
- Modifier : `lib/nav.ts` (+ tests), `components/LeagueTabs.tsx`, `app/page.tsx`, `lib/home.ts`, `lib/db-stats.ts` (ligues publiques seulement), `middleware.ts` ou `next.config.mjs` (redirections), `scripts/home-nav-check.mjs`
- Supprimer : `app/(ligue)/` (pages déplacées), `getActiveLeague` (plus d'appelant ; l'admin passe en tâche 4, il garde une version temporaire via `getFeaturedLeague` si besoin)

**Interfaces produites :**
```ts
// lib/nav.ts
leagueTabs({ leagueId, hasPlayoffs, canManage }): NavLink[]   // /ligues/<id>/classement, calendrier, (playoffs), (gerer)
// SECTIONS : '/ligues' allume toute la section /ligues
// lib/leagues/load.ts
loadVisibleLeague(id): Promise<{ league: DbLeague; viewer: Viewer; isMember: boolean; canManage: boolean }>  // notFound() si invisible
```

- [ ] **Étape 1 : tests de `lib/nav.ts`** : `mainLinks` mène « Ligue » à `/ligues` ; `isActive('/ligues', '/ligues/abc/calendrier')` est vrai ; `leagueTabs` donne les quatre onglets avec l'identifiant, « Playoffs » seulement si `hasPlayoffs`, « Gérer » seulement si `canManage`.
- [ ] **Étape 2 : tests de `lib/db-stats.ts`** : un match d'une ligue privée n'entre pas dans `listMatchStats`.
- [ ] **Étape 3 : implémenter** nav, stats, `loadVisibleLeague`, puis les pages (contenu repris des pages actuelles avec `league.id` au lieu de la ligue active). En-tête de la ligue : nom, « Organisée par X » (ou « Ligue du site »), badge « Privée », état (en cours / terminée le …).
- [ ] **Étape 4 : liste `/ligues`** : sections « Mes ligues », « Ligues publiques en cours », « Ligues terminées » ; bouton « Créer une ligue » pour un joueur (vers `/ligues/nouvelle`, faite en tâche 4) ; lien « Statistiques ».
- [ ] **Étape 5 : redirections** (`middleware.ts`, qui tourne déjà sur l'edge) : `/classement`, `/calendar`, `/playoffs` → page équivalente de `getFeaturedLeague(viewer)` ou `/ligues` ; `/history` → `/ligues` ; `/history/<id>` → `/ligues/<id>` ; `/stats` → `/ligues/statistiques`. Si la redirection dépendante de la session est trop lourde dans le middleware, la faire par des pages serveur minimales qui appellent `redirect()` à l'ancienne adresse. Test unitaire de la fonction de correspondance des adresses.
- [ ] **Étape 6 : accueil** : encart de la ligue mise en avant (`getFeaturedLeague`), liens vers ses pages, lien « Toutes les ligues » vers `/ligues` ; textes de `lib/home.ts` mis à jour (« Crée ta ligue entre amis, publique ou privée… »).
- [ ] **Étape 7 : vérifications** tests, tsc, build ; `scripts/home-nav-check.mjs` adapté (`**/ligues/*/classement`, `**/ligues/*/calendrier`) et rejoué.
- [ ] **Étape 8 : commit** `feat(ligues): pages de chaque ligue sous /ligues, anciennes adresses redirigées`

---

### Tâche 4 : créer, rejoindre et gérer une ligue

**Fichiers :**
- Créer : `app/ligues/nouvelle/page.tsx` (+ `NewLeagueForm.tsx`), `app/ligues/[id]/gerer/page.tsx` (+ `ManageLeague.tsx`), `components/leagues/InvitePanel.tsx`, `components/leagues/MyEntry.tsx` (deck et « Quitter la ligue » pour l'inscrit), `app/ligues/rejoindre/[token]/page.tsx` (+ `JoinButton.tsx`)
- Modifier : `components/admin/LeagueHeader.tsx`, `ParticipantsPanel.tsx`, `RoundRobinPanel.tsx`, `PlayoffsPanel.tsx` (paramétrés par la ligue), `app/admin/page.tsx` + `AdminDashboard.tsx` (comptes + liste de toutes les ligues), `app/ligues/[id]/classement/page.tsx` (affiche `MyEntry`)

- [ ] **Étape 1 : création** : formulaire nom + visibilité (radio « Publique : visible par tous », « Privée : visible par ses joueurs seulement ») ; après création, redirection vers `/ligues/<id>/gerer`. Réservé aux joueurs connectés (sinon redirection vers la connexion).
- [ ] **Étape 2 : page de gestion** : `loadVisibleLeague` puis `notFound()` si `!canManage`. Reprend les panneaux de `/admin` (en-tête avec renommer, visibilité, clôturer, supprimer ; participants ; round-robin ; playoffs). Le panneau participants propose **tous les comptes** pour l'ajout direct ; la création de joueur sans compte (`POST /api/players`) reste réservée à l'admin (bouton masqué sinon).
- [ ] **Étape 3 : lien d'invitation** : `InvitePanel` affiche le lien complet (`${origin}/ligues/rejoindre/<jeton>`), bouton « Copier le lien » (presse-papiers, toast « Lien copié »), bouton « Renouveler le lien » avec confirmation (« L'ancien lien ne marchera plus. ») ; s'il n'y a pas encore de jeton, bouton « Créer un lien d'invitation ». Masqué une fois les matchs générés.
- [ ] **Étape 4 : page rejoindre** : visiteur → `redirect('/connexion?from=/ligues/rejoindre/<jeton>')` ; la page de connexion affiche « Pas encore de compte ? Demande une invitation à l'administrateur. » quand `from` commence par `/ligues/rejoindre/`. Jeton invalide → message de la spec. Déjà inscrit → « Tu es déjà inscrit » + lien. Sinon nom de la ligue, organisateur, nombre d'inscrits, bouton « Rejoindre » → `POST /api/leagues/join` puis redirection vers la ligue.
- [ ] **Étape 5 : `MyEntry`** sur le classement pour un inscrit : choix de son deck parmi ses decks (`PATCH …/players/<moi>`), « Quitter la ligue » avant génération des matchs (confirmation).
- [ ] **Étape 6 : `/admin`** : garde `AccountsPanel` ; ajoute la liste de toutes les ligues (nom, organisateur, visibilité, état) avec lien « Gérer ». Plus de gestion de ligue directement dans `/admin`.
- [ ] **Étape 7 : vérifications** tests, tsc, build.
- [ ] **Étape 8 : commit** `feat(ligues): création, lien d'invitation et gestion d'une ligue par son organisateur`

---

### Tâche 5 : vérification navigateur et documentation

**Fichiers :**
- Créer : `scripts/leagues-check.mjs`
- Modifier : `scripts/seed-online.mjs` (si besoin d'une ligue de test), `CLAUDE.md` (ligne du nouveau script), `docs/superpowers/roadmap.md`

- [ ] **Étape 1 : script** (même structure que `home-nav-check.mjs`, cookies `jeton-de-test-<id>`) :
  1. Ana (`e2e-1`) crée « Ligue privée e2e » en privée → arrive sur la gestion ; crée le lien et le lit dans la page.
  2. Bastien (`e2e-2`) ouvre le lien → « Rejoindre » → voit le classement de la ligue.
  3. Chloé (`e2e-3`) ouvre `/ligues/<id>/classement` → 404 ; ne la voit pas dans `/ligues`.
  4. Visiteur sur le lien → page de connexion avec le message d'invitation.
  5. Ana ajoute Damien directement, génère les matchs, saisit un score ; le classement le reflète.
  6. Bastien ne voit pas l'onglet « Gérer » et reçoit 404 sur `/ligues/<id>/gerer`.
  7. `/classement` redirige vers une page `/ligues/<id>/classement`.
  Captures dans le dossier passé en argument.
- [ ] **Étape 2 : lancer** le script et `home-nav-check.mjs` sur `wrangler pages dev` ; corriger.
- [ ] **Étape 3 : documentation** : ligne du script dans `CLAUDE.md` ; roadmap : nouveau chantier « Refonte des ligues » avec ses quatre parties, partie 1 faite.
- [ ] **Étape 4 : commit** `test(ligues): parcours navigateur des ligues de joueurs` puis PR qui ferme les issues de la partie 1.
