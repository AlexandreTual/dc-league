# Design — Comptes joueurs

**Date :** 2026-10-03  
**Statut :** En relecture  
**Sous-projet :** 1/3 de la feuille de route « jeu en ligne » (1. comptes joueurs → 2. import de decks Scryfall FR → 3. mode test solo → plus tard multijoueur)

---

## Contexte

Aujourd'hui, seul l'admin peut se connecter, via un mot de passe partagé (`ADMIN_PASSWORD`). Le cookie de session contient ce mot de passe encodé en base64 (`lib/auth.ts`) : quiconque voit le cookie connaît le mot de passe.

Pour la suite (import de decks par les joueurs, mode test, jeu en ligne), chaque joueur doit avoir un **compte personnel** relié à son profil `players` existant, afin de conserver l'historique de la ligue.

## Objectifs

- Chaque joueur peut se connecter avec un pseudo et un mot de passe.
- Les comptes sont créés **uniquement sur invitation** générée par un admin.
- L'admin devient un **rôle** porté par un compte joueur (fin du mot de passe partagé).
- Un joueur connecté peut : se déconnecter, changer son mot de passe, modifier son profil (nom affiché, avatar), gérer ses propres decks.

## Hors périmètre

- Saisie des scores par les joueurs (viendra avec l'enregistrement automatique en fin de partie en ligne).
- Connexion Discord (le modèle la permet, voir plus bas, mais elle n'est pas implémentée).
- Envoi d'e-mails, inscription libre.
- Upload de fichier pour l'avatar (reste une URL).
- Import de liste de deck (sous-projet 2).

---

## Modèle de données

Nouvelle migration `migrations/0002_accounts.sql`. Aucune table existante n'est modifiée.

```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  player_id     TEXT NOT NULL UNIQUE REFERENCES players(id) ON DELETE CASCADE,
  username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,                -- format "pbkdf2$<iterations>$<sel b64>$<empreinte b64>", NULL possible (futur Discord)
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,       -- SHA-256 (hex) du jeton du cookie ; le jeton n'est jamais stocké
  user_id    TEXT NOT NULL,          -- id de users, ou 'bootstrap' (voir Démarrage) ; pas de clé étrangère
  expires_at TEXT NOT NULL,          -- ISO 8601
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS invitations (
  id          TEXT PRIMARY KEY,      -- SHA-256 (hex) du jeton du lien
  player_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('signup', 'reset')),
  grant_admin INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_invitations_player ON invitations(player_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  username     TEXT NOT NULL COLLATE NOCASE,
  attempted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username, attempted_at);
```

Principes :

- Un joueur a **au plus un** compte (`users.player_id` unique) ; un compte est toujours relié à un joueur.
- Le **nom affiché** reste `players.name` ; le **pseudo de connexion** est `users.username`. Ils sont indépendants.
- Connexion Discord future : ajout d'une colonne `discord_id` ; `password_hash` nullable permet un compte sans mot de passe.
- Le format de `password_hash` embarque l'algorithme et le nombre d'itérations pour pouvoir les faire évoluer.

### Constantes

| Constante | Valeur |
|---|---|
| Itérations PBKDF2-SHA256 | 100 000 (maximum autorisé par Cloudflare Workers) |
| Taille du sel | 16 octets |
| Taille des jetons (session, invitation) | 32 octets aléatoires, encodés base64url |
| Durée de session | 30 jours ; à chaque lecture, si l'expiration est à moins de 29 jours, elle est repoussée à maintenant + 30 jours (au plus une écriture par jour et par session) |
| Durée d'une invitation | 7 jours |
| Mot de passe | 8 caractères minimum, 200 maximum |
| Pseudo | 3 à 32 caractères, lettres, chiffres, `_`, `-`, `.` |
| Anti-force brute | 5 échecs en 15 min sur un pseudo → refus pendant 15 min (429) |
| Nom du cookie | `dc_session` |

---

## Parcours

### Démarrage (une seule fois)

1. Tant qu'**aucun compte admin n'existe**, `/connexion` propose aussi l'ancien mode « mot de passe admin » (`ADMIN_PASSWORD`). Il ouvre une session spéciale de démarrage, limitée à l'administration.
2. L'admin génère sa propre invitation (case « admin » cochée), crée son compte et est connecté avec.
3. Dès qu'un compte admin existe, le mode `ADMIN_PASSWORD` est refusé. La variable peut être retirée de Cloudflare.

La session de démarrage est une ligne `sessions` avec `user_id` égal à la valeur spéciale `bootstrap`, d'où l'absence de clé étrangère sur `sessions.user_id`. Elle n'est valable que tant qu'aucun admin n'existe, ce qui est vérifié à chaque lecture. Une session dont le `user_id` ne correspond à aucun compte (compte supprimé avec son joueur) est traitée comme absente et supprimée.

### Inviter un joueur (admin)

- Sur chaque joueur, l'admin voit un état : « Pas de compte », « Invitation en attente » ou « Compte : <pseudo> ».
- Sur un joueur sans compte, le bouton « Inviter », avec une case « admin », génère un lien `/invitation/<jeton>` affiché avec un bouton « Copier ».
- Générer une invitation **invalide les invitations non utilisées** du même joueur.

### Créer son compte (`/invitation/<jeton>`, type `signup`)

- La page affiche « Bienvenue <nom du joueur> », puis un formulaire : pseudo, mot de passe, confirmation.
- Une fois validé, dans une seule transaction (`db.batch`) : création du `users`, marquage `used_at`, puis ouverture d'une session et redirection vers `/profil`.
- Si le joueur a déjà un compte (cas de course) : 409.
- Si le pseudo est pris : 409 « Ce pseudo est déjà utilisé ».

### Mot de passe oublié (type `reset`)

- Sur un joueur avec compte, l'admin a le bouton « Lien de réinitialisation ».
- La page `/invitation/<jeton>` affiche le formulaire de nouveau mot de passe.
- Une fois validé : mise à jour du hachage, suppression de **toutes** les sessions du compte, ouverture d'une nouvelle session.

### Invitation invalide

- Si le jeton est inconnu, expiré ou déjà utilisé, une page explicative s'affiche : « Ce lien n'est plus valide, demande un nouveau lien à l'admin. »

### Connexion et déconnexion

- `/connexion` : pseudo et mot de passe. `?from=` permet de revenir à la page demandée, uniquement si c'est un chemin interne commençant par `/`.
- `/admin/login` redirige vers `/connexion`.
- En cas d'échec, le message est toujours le même : « Pseudo ou mot de passe incorrect ». Chaque échec ajoute une ligne `login_attempts`. Une connexion réussie efface les tentatives de ce pseudo. Les tentatives de plus de 15 minutes sont supprimées au passage.
- Pseudo inconnu : on exécute quand même une vérification PBKDF2 sur une empreinte factice, pour ne pas révéler par le temps de réponse que le pseudo n'existe pas.
- Déconnexion : suppression de la session en base et du cookie.

### Navigation

- Visiteur : lien « Connexion ».
- Connecté : avatar et nom du joueur, avec un menu « Mon profil », « Mes decks » et « Déconnexion ».
- Le lien « Admin » n'est visible que pour un admin.

### Gestion des admins

- Un admin peut donner ou retirer le rôle admin à un autre compte.
- Il est impossible de retirer le rôle au **dernier** admin (409).

---

## Architecture

### `lib/auth/crypto.ts` (pur, sans base)

- `hashPassword(password): Promise<string>`
- `verifyPassword(password, stored): Promise<boolean>` : comparaison en temps constant, `false` si le format est invalide.
- `generateToken(): string` : 32 octets aléatoires en base64url.
- `hashToken(token): Promise<string>` : SHA-256 en hexadécimal.

Uniquement WebCrypto (`crypto.subtle`, `crypto.getRandomValues`), compatible avec l'environnement edge.

### `lib/auth/validation.ts` (pur)

- `validateUsername(s)` et `validatePassword(s)` : renvoient `null` ou un message d'erreur en français.
- `safeRedirectPath(from)` : renvoie le chemin s'il est interne (commence par `/` mais pas par `//`), sinon `/profil`.

### `lib/auth/permissions.ts` (pur)

- `canEditDeck(user, deck)` : vrai si `user.isAdmin` ou si `deck.player_id === user.playerId`.
- `canCreateDeckFor(user, playerId)` : même règle.

### `lib/db-auth.ts` (accès D1, format `{ data, error }`)

- Comptes : `getUserByUsername`, `getUserById` (avec jointure sur `players` pour le nom et l'avatar), `createUserFromInvitation`, `updatePasswordHash`, `setAdmin` (avec la protection du dernier admin), `countAdmins`, `listUsersByPlayer`.
- Sessions : `insertSession`, `getSession`, `extendSession`, `deleteSession`, `deleteUserSessions`, `deleteExpiredSessions`.
- Invitations : `createInvitation` (invalide d'abord les invitations en attente du joueur), `getValidInvitation(idHash, now)`, `markInvitationUsed`.
- Anti-force brute : `countRecentFailures(username, now)`, `recordFailure`, `clearFailures`.
- Toute fonction qui dépend de l'heure reçoit `now: Date` en paramètre.

### `lib/auth/session.ts` (cookies Next et D1)

- `getCurrentUser(): Promise<CurrentUser | null>` avec `CurrentUser = { id, playerId, username, isAdmin, playerName, avatarUrl, isBootstrap }`.
- `createSession(userId)` : génère le jeton, enregistre son empreinte et pose le cookie (`httpOnly`, `secure`, `SameSite=Lax`, `path=/`, durée de 30 jours).
- `destroySession()`.
- `requireUser()` et `requireAdmin()` : renvoient soit l'utilisateur, soit une `NextResponse` 401 ou 403 à retourner.
- `isAdminAuthenticated()`, déjà utilisée par les routes admin existantes, est **réécrite** comme `getCurrentUser()` puis vérification de `isAdmin` ou `isBootstrap`. Les routes admin existantes ne changent pas.
- `assertSameOrigin(req)` : refuse (403) toute requête qui modifie des données si son en-tête `Origin` est présent et différent de l'hôte de la requête.

### `middleware.ts`

- Pour `/admin/:path*` et `/profil/:path*` : redirection vers `/connexion?from=<chemin>` si le cookie `dc_session` est **absent**. Aucun accès à la base.
- La vérification réelle (session valide, rôle) se fait dans les pages serveur et les routes d'API.
- `/admin/*` vérifie `isAdminAuthenticated()` côté serveur et redirige vers `/` si l'utilisateur n'est pas admin.

### Routes d'API

| Route | Rôle | Accès |
|---|---|---|
| `POST /api/auth/login` | `{ username, password }` ou `{ adminPassword }` (démarrage) | public |
| `POST /api/auth/logout` | déconnexion | connecté |
| `POST /api/auth/invitation/[token]` | `signup` : `{ username, password }` ; `reset` : `{ password }` | jeton valide |
| `PATCH /api/me/profile` | `{ name?, avatar_url? }` (met à jour `players`) | connecté, hors session de démarrage |
| `PATCH /api/me/password` | `{ currentPassword, newPassword }` ; ferme les autres sessions | connecté, hors session de démarrage |
| `POST /api/players/[id]/decks` | création de deck (route existante) | `canCreateDeckFor` |
| `PATCH /api/decks/[id]` | `{ name?, moxfield_url?, commander_image_url? }` | `canEditDeck` |
| `DELETE /api/decks/[id]` | suppression ; 409 si le deck est référencé par `league_players.deck_id` | `canEditDeck` |
| `POST /api/admin/invitations` | `{ player_id, kind, grant_admin? }` → `{ url }` ; `signup` refusé (409) si le joueur a déjà un compte, `reset` refusé (409) s'il n'en a pas | admin |
| `PATCH /api/admin/users/[id]` | `{ is_admin }` | admin |

Les fonctions d'accès aux decks nécessaires (`getDeck`, `updateDeck`, `deleteDeck`, `isDeckUsedInLeague`) vont dans `lib/db-decks.ts`.

### Pages

- `app/connexion/page.tsx` : formulaire de connexion, et le formulaire « mot de passe admin » si aucun admin n'existe.
- `app/invitation/[token]/page.tsx` : création de compte, nouveau mot de passe ou message de lien invalide.
- `app/profil/page.tsx` : nom affiché, URL de l'avatar, changement de mot de passe.
- `app/profil/decks/page.tsx` : liste de mes decks, avec création, modification et suppression.
- `app/admin/login/page.tsx` : redirection vers `/connexion`.
- `components/Navbar.tsx` : reçoit l'utilisateur courant (lu dans `app/layout.tsx` côté serveur) et affiche le menu adapté.
- `app/admin/AdminDashboard.tsx` : état du compte et boutons d'invitation, de réinitialisation et de rôle admin pour chaque joueur.

---

## Gestion des erreurs

- Les routes renvoient `{ error: "<message FR>" }` avec les codes 400, 401, 403, 404, 409 ou 429 selon le cas.
- Les messages ne révèlent jamais si un pseudo existe.
- Les sessions expirées sont traitées comme absentes, et `deleteExpiredSessions(now)` est appelé de façon opportuniste à chaque connexion réussie.
- Les erreurs D1 inattendues donnent un 500 avec un message générique, et le détail est écrit dans les journaux.

---

## Tests

- **Vitest** est ajouté (`npm test`).
- **Fonctions pures** : `crypto.ts`, `validation.ts`, `permissions.ts`.
- **`lib/db-auth.ts` et les nouvelles fonctions de `lib/db-decks.ts`** : testées contre une vraie base SQLite en mémoire (module intégré `node:sqlite` de Node 22, aucune dépendance native), via un petit adaptateur qui imite l'interface D1 utilisée (`prepare`, `bind`, `first`, `all`, `run`, `batch`) et applique `migrations/0001_schema.sql` et `0002_accounts.sql`.
- **Cas couverts** :
  - pseudo unique sans distinction de majuscules ;
  - invitation à usage unique, expirée, ou annulée par une invitation plus récente ;
  - `signup` refusé si le joueur a déjà un compte ;
  - `reset` qui ferme toutes les sessions ;
  - blocage après 5 échecs puis libération après 15 minutes ;
  - protection du dernier admin ;
  - refus de supprimer un deck utilisé dans une ligue ;
  - session expirée ignorée ;
  - session de démarrage invalide dès qu'un admin existe.
- **Vérifications avant de déclarer le travail terminé** : `npm test`, `npx tsc --noEmit`, `npm run lint`, build `next-on-pages`. Si l'environnement le permet, un parcours manuel avec `wrangler pages dev` ; sinon, la liste des vérifications est remise à l'utilisateur.

---

## Déploiement

1. `npm run db:migrate:remote` (applique `0002_accounts.sql`).
2. Déployer.
3. Se connecter sur `/connexion` avec `ADMIN_PASSWORD`, générer sa propre invitation « admin » et créer son compte.
4. Inviter les joueurs.
5. Optionnel : retirer `ADMIN_PASSWORD` des variables Cloudflare.
