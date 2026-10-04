# Comptes joueurs — Plan d'implémentation

> **Pour l'implémenteur :** exécuter les tâches dans l'ordre, en TDD (test qui échoue → code minimal → test qui passe → commit). Les étapes utilisent des cases à cocher (`- [ ]`).

**Objectif :** donner à chaque joueur un compte personnel (pseudo + mot de passe, sur invitation), faire de l'admin un rôle porté par un compte, et permettre à chaque joueur de gérer son profil et ses decks.

**Architecture :** sessions maison stockées dans D1 (empreinte SHA-256 du jeton de cookie), mots de passe PBKDF2 via WebCrypto. La logique est découpée en couches testables : fonctions pures (`lib/auth/crypto|validation|permissions`), accès D1 (`lib/db-auth.ts`), services métier sans dépendance à Next (`lib/auth/service.ts`, `lib/auth/resolve.ts`), puis une fine couche Next (`lib/auth/session.ts`, routes, pages).

**Stack :** Next.js 15 App Router (runtime edge) sur Cloudflare Pages via `@cloudflare/next-on-pages`, D1, TypeScript strict, Tailwind, Lucide. Tests : Vitest + `node:sqlite` (Node 22) derrière un adaptateur D1.

**Spec :** `docs/superpowers/specs/2026-10-03-player-accounts-design.md`

## Contraintes globales

- PBKDF2-SHA256, **100 000** itérations, sel de **16** octets, format `pbkdf2$100000$<sel b64>$<empreinte b64>`.
- Jetons (session, invitation) : **32** octets aléatoires, base64url ; en base, uniquement leur SHA-256 en hexadécimal.
- Session : **30 jours** ; prolongée à maintenant + 30 jours quand l'expiration est à moins de **29 jours**.
- Invitation : **7 jours**, usage unique ; une nouvelle invitation supprime les invitations non utilisées du même joueur.
- Mot de passe : **8 à 200** caractères. Pseudo : **3 à 32** caractères dans `[A-Za-z0-9_.-]`, unique sans distinction de casse.
- Anti-force brute : **5** échecs en **15 min** sur un pseudo → 429 pendant 15 min.
- Cookie `dc_session` : `httpOnly`, `secure`, `SameSite=Lax`, `path=/`, `maxAge` 30 jours.
- Message d'échec de connexion unique : « Pseudo ou mot de passe incorrect ».
- Session de démarrage : `sessions.user_id = 'bootstrap'`, valable uniquement tant que `countAdmins() === 0`.
- Toutes les routes d'API : `export const runtime = 'edge'`, réponses d'erreur `{ error: "<message FR>" }`.
- Toute fonction dépendant de l'heure prend `now: Date` en paramètre.

## Points de vigilance (Review Focus)

1. **Casse du pseudo** : un compte créé « Alex » doit pouvoir se connecter avec « alex », et « ALEX » doit être refusé à l'inscription comme déjà pris. → tests Tâche 4 et Tâche 7.
2. **Double soumission d'une invitation** (double clic, deux onglets) : un seul compte créé, la seconde requête reçoit « lien plus valide ». → test Tâche 4 (`createUserFromInvitation` appelé deux fois).
3. **Redirection ouverte** : `?from=//evil.com` ou `?from=https://evil.com` doit renvoyer vers `/profil`. → test Tâche 3.
4. **L'admin se retire lui-même son rôle alors qu'il est le dernier** : refus 409. → test Tâche 4.
5. **Session de démarrage après création du premier admin** : elle doit cesser de fonctionner immédiatement, même si le cookie est encore valide. → test Tâche 6.

---

## Carte des fichiers

| Action | Fichier | Responsabilité |
|---|---|---|
| Créer | `migrations/0002_accounts.sql` | Tables `users`, `sessions`, `invitations`, `login_attempts` (SQL exact dans la spec) |
| Créer | `vitest.config.ts` | Config Vitest (alias `@`) |
| Créer | `test/d1.ts` | Adaptateur D1 au-dessus de `node:sqlite` + `createTestDb()` |
| Créer | `lib/auth/types.ts` | `CurrentUser`, `ServiceResult` |
| Créer | `lib/auth/crypto.ts` | Hachage, vérification, jetons |
| Créer | `lib/auth/validation.ts` | Validation pseudo / mot de passe, redirection sûre |
| Créer | `lib/auth/permissions.ts` | Règles d'accès aux decks |
| Créer | `lib/db-auth.ts` | Accès D1 : comptes, invitations, sessions, tentatives |
| Modifier | `lib/db-decks.ts` | `getDeck`, `updateDeck`, `deleteDeck`, `isDeckUsedInLeague` |
| Créer | `lib/auth/resolve.ts` | Jeton de cookie → `CurrentUser` (expiration, démarrage, prolongation) |
| Créer | `lib/auth/service.ts` | Connexion, démarrage, acceptation d'invitation, changement de mot de passe, émission d'invitation |
| Remplacer | `lib/auth.ts` → `lib/auth/session.ts` | Couche Next : cookies, `getCurrentUser`, `requireUser`, `requireAdmin`, `isAdminAuthenticated`, `assertSameOrigin` |
| Modifier | `middleware.ts` | Redirection si pas de cookie ; rafraîchissement du `maxAge` |
| Créer | `app/api/auth/login/route.ts`, `logout/route.ts`, `invitation/[token]/route.ts` | Routes d'authentification |
| Créer | `app/api/me/profile/route.ts`, `app/api/me/password/route.ts` | Profil et mot de passe |
| Créer | `app/api/decks/[id]/route.ts` | PATCH / DELETE d'un deck |
| Modifier | `app/api/players/[id]/decks/route.ts` | POST autorisé au propriétaire |
| Créer | `app/api/admin/invitations/route.ts`, `app/api/admin/users/[id]/route.ts` | Invitations, rôle admin |
| Supprimer | `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts` | Remplacées par `/api/auth/*` |
| Créer | `app/connexion/page.tsx` (+ `LoginForm.tsx`) | Page de connexion |
| Créer | `app/invitation/[token]/page.tsx` (+ `InvitationForm.tsx`) | Création de compte / nouveau mot de passe |
| Créer | `app/profil/page.tsx` (+ `ProfileForms.tsx`) | Profil, mot de passe |
| Créer | `app/profil/decks/page.tsx` (+ `MyDecks.tsx`) | Mes decks |
| Modifier | `app/admin/login/page.tsx` | Redirection vers `/connexion` |
| Modifier | `app/layout.tsx`, `components/Navbar.tsx` | Menu selon l'utilisateur courant |
| Modifier | `app/admin/page.tsx`, `app/admin/AdminDashboard.tsx` | Garde admin, état des comptes, boutons |
| Modifier | `package.json` | `vitest`, script `test` |

Les routes existantes qui importent `isAdminAuthenticated` depuis `@/lib/auth` continuent de fonctionner : `lib/auth.ts` est conservé comme simple ré-export de `lib/auth/session.ts` (une ligne), pour ne pas toucher les ~15 routes admin existantes.

---

### Tâche 1 : Outillage de test et migration

**Fichiers :**
- Créer : `migrations/0002_accounts.sql`, `vitest.config.ts`, `test/d1.ts`, `test/d1.test.ts`
- Modifier : `package.json`

**Interfaces :**
- Produit : `createTestDb(): D1Database` (base `:memory:` avec `0001_schema.sql` puis `0002_accounts.sql` appliqués, `PRAGMA foreign_keys = ON`).

- [ ] **Étape 1 : installer les dépendances**

`npm install` puis `npm install -D vitest`. Ajouter `"test": "vitest run"` dans `scripts`.

- [ ] **Étape 2 : écrire la migration** `migrations/0002_accounts.sql` en copiant exactement le SQL de la section « Modèle de données » de la spec (`sessions.user_id` sans `REFERENCES`).

- [ ] **Étape 3 : écrire le test qui échoue** `test/d1.test.ts`

```ts
it('applique les migrations', async () => {
  const db = createTestDb()
  const row = await db.prepare("SELECT name FROM sqlite_master WHERE name = 'users'").first<{ name: string }>()
  expect(row?.name).toBe('users')
})
it('first renvoie null si aucune ligne', async () => {
  expect(await createTestDb().prepare('SELECT * FROM users WHERE id = ?').bind('x').first()).toBeNull()
})
it('run renvoie meta.changes et batch est atomique', async () => {
  const db = createTestDb()
  const r = await db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'A')").run()
  expect(r.meta.changes).toBe(1)
  await expect(db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p2', 'B')"),
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'dup')"),
  ])).rejects.toThrow()
  expect(await db.prepare("SELECT id FROM players WHERE id = 'p2'").first()).toBeNull()
})
```

- [ ] **Étape 4 : lancer** `npm test` → échec (`createTestDb` n'existe pas).

- [ ] **Étape 5 : implémenter** `vitest.config.ts` (environnement `node`, alias `@` → racine) et `test/d1.ts`.

`node:sqlite` est chargé via `createRequire(import.meta.url)('node:sqlite')` (Vite ne connaît pas ce module intégré). L'adaptateur implémente seulement ce que le projet utilise : `prepare(sql)` → objet avec `bind(...values)` (renvoie un nouvel objet lié), `first<T>(col?)`, `all<T>()` → `{ results }`, `run()` → `{ success: true, meta: { changes, last_row_id } }` ; `db.batch(stmts)` exécute tout entre `BEGIN` / `COMMIT` avec `ROLLBACK` en cas d'erreur. Les `undefined` liés sont convertis en `null`. Retourner l'objet casté en `D1Database`.

- [ ] **Étape 6 : lancer** `npm test` → PASS.

- [ ] **Étape 7 : commit** `test: outillage Vitest + adaptateur D1 + migration comptes`

---

### Tâche 2 : Cryptographie

**Fichiers :** Créer `lib/auth/crypto.ts`, `lib/auth/crypto.test.ts`

**Interfaces — Produit :**
- `PBKDF2_ITERATIONS = 100_000`
- `hashPassword(password: string): Promise<string>`
- `verifyPassword(password: string, stored: string | null): Promise<boolean>`
- `verifyDummyPassword(password: string): Promise<void>` : exécute une vérification sur une empreinte factice (calculée une fois puis mémorisée), pour égaliser le temps de réponse.
- `generateToken(): string`
- `hashToken(token: string): Promise<string>` (hex minuscule, 64 caractères)

- [ ] **Étape 1 : tests qui échouent**

```ts
it('accepte le bon mot de passe et refuse un mauvais', async () => {
  const h = await hashPassword('motdepasse1')
  expect(h).toMatch(/^pbkdf2\$100000\$[^$]+\$[^$]+$/)
  expect(await verifyPassword('motdepasse1', h)).toBe(true)
  expect(await verifyPassword('motdepasse2', h)).toBe(false)
})
it('sel différent à chaque hachage', async () => {
  expect(await hashPassword('x'.repeat(8))).not.toBe(await hashPassword('x'.repeat(8)))
})
it.each([null, '', 'bcrypt$1$a$b', 'pbkdf2$abc$a$b', 'pbkdf2$100000$a'])('refuse un hachage invalide %s', async (s) => {
  expect(await verifyPassword('motdepasse1', s)).toBe(false)
})
it('jetons uniques en base64url de 43 caractères', () => {
  const a = generateToken(), b = generateToken()
  expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
  expect(a).not.toBe(b)
})
it('hashToken est stable', async () => {
  expect(await hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
```

- [ ] **Étape 2 : lancer** `npx vitest run lib/auth/crypto.test.ts` → FAIL.
- [ ] **Étape 3 : implémenter** avec `crypto.subtle.importKey('raw', …, 'PBKDF2')` + `deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)`. Comparaison en temps constant par XOR cumulé sur les octets. Le nombre d'itérations est lu dans la chaîne stockée (refuser si non entier ou > 100 000). Base64 via `btoa`/`atob` (pas de `Buffer`).
- [ ] **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(auth): hachage PBKDF2 et jetons`

---

### Tâche 3 : Validation et permissions

**Fichiers :** Créer `lib/auth/types.ts`, `lib/auth/validation.ts`, `lib/auth/permissions.ts`, `lib/auth/validation.test.ts`, `lib/auth/permissions.test.ts`

**Interfaces — Produit :**
- `types.ts` :
  ```ts
  export type CurrentUser = { id: string; playerId: string; username: string; isAdmin: boolean; playerName: string; avatarUrl: string | null; isBootstrap: boolean }
  export type ServiceResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string }
  ```
- `validateUsername(s: string): string | null` ; `validatePassword(s: string): string | null` ; `safeRedirectPath(from: string | null | undefined): string`
- `canEditDeck(user: Pick<CurrentUser, 'isAdmin' | 'playerId'>, deck: { player_id: string }): boolean` ; `canCreateDeckFor(user: Pick<CurrentUser, 'isAdmin' | 'playerId'>, playerId: string): boolean`

- [ ] **Étape 1 : tests qui échouent**

```ts
it.each(['al', 'a'.repeat(33), 'al ex', 'alex!', ''])('refuse le pseudo %s', (s) => expect(validateUsername(s)).not.toBeNull())
it.each(['alex', 'Alex_42', 'a.b-c', 'a'.repeat(32)])('accepte le pseudo %s', (s) => expect(validateUsername(s)).toBeNull())
it('mot de passe 8..200', () => {
  expect(validatePassword('1234567')).not.toBeNull()
  expect(validatePassword('12345678')).toBeNull()
  expect(validatePassword('x'.repeat(201))).not.toBeNull()
})
it.each([[null, '/profil'], ['', '/profil'], ['//evil.com', '/profil'], ['https://evil.com', '/profil'], ['/\\evil.com', '/profil'], ['/admin', '/admin'], ['/profil/decks?x=1', '/profil/decks?x=1']])('safeRedirectPath(%s) = %s', (i, o) => expect(safeRedirectPath(i)).toBe(o))
it('canEditDeck', () => {
  expect(canEditDeck({ isAdmin: false, playerId: 'p1' }, { player_id: 'p1' })).toBe(true)
  expect(canEditDeck({ isAdmin: false, playerId: 'p1' }, { player_id: 'p2' })).toBe(false)
  expect(canEditDeck({ isAdmin: true, playerId: 'p1' }, { player_id: 'p2' })).toBe(true)
})
```
(même trio de cas pour `canCreateDeckFor`.)

- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** Messages : « Le pseudo doit faire 3 à 32 caractères (lettres, chiffres, _ . -) », « Le mot de passe doit faire au moins 8 caractères », « Le mot de passe est trop long ». `safeRedirectPath` refuse tout ce qui ne commence pas par `/`, ou commence par `//` ou `/\`.
- [ ] **Étape 4 : lancer** → PASS. **Étape 5 : commit** `feat(auth): validation et permissions`

---

### Tâche 4 : Accès D1 — comptes et invitations

**Fichiers :** Créer `lib/db-auth.ts`, `lib/db-auth.users.test.ts`

**Interfaces :**
- Consomme : `createTestDb()` (T1), `Result<T>` exporté par `lib/db.ts`.
- Produit (toutes renvoient `Promise<Result<…>>`) :
  - `type DbUser = { id: string; player_id: string; username: string; password_hash: string | null; is_admin: boolean; created_at: string }`
  - `type DbInvitation = { id: string; player_id: string; player_name: string; kind: 'signup' | 'reset'; grant_admin: boolean; expires_at: string }`
  - `type AccountStatus = { status: 'none' } | { status: 'pending'; expiresAt: string } | { status: 'account'; userId: string; username: string; isAdmin: boolean }`
  - Codes d'erreur exportés : `AUTH_ERR = { USERNAME_TAKEN, PLAYER_HAS_ACCOUNT, INVITATION_INVALID, LAST_ADMIN, NOT_FOUND }` (chaînes constantes).
  - `getUserByUsername(db, username)` → `DbUser | null` (comparaison `COLLATE NOCASE`)
  - `getUserByPlayerId(db, playerId)` → `DbUser | null`
  - `countAdmins(db)` → `number`
  - `createInvitation(db, { idHash, playerId, kind, grantAdmin, now })` → `{ expiresAt: string }` : en `batch`, `DELETE` des invitations non utilisées du joueur puis `INSERT` (expiration `now + 7 j`).
  - `getValidInvitation(db, idHash, now)` → `DbInvitation | null` (non utilisée, non expirée, jointure `players.name`).
  - `createUserFromInvitation(db, { invitationId, username, passwordHash, now })` → `DbUser` : en `batch`, `INSERT INTO users … SELECT … FROM invitations WHERE id = ? AND kind = 'signup' AND used_at IS NULL AND expires_at > ?` (reprend `player_id` et `grant_admin`), puis `UPDATE invitations SET used_at`. Si l'insert touche 0 ligne → `INVITATION_INVALID`. Violation d'unicité sur `username` → `USERNAME_TAKEN` ; sur `player_id` → `PLAYER_HAS_ACCOUNT`.
  - `resetPasswordFromInvitation(db, { invitationId, passwordHash, now })` → `{ userId: string }` : en `batch`, mise à jour du hachage du compte du joueur de l'invitation (conditionnée à la validité de l'invitation, `kind = 'reset'`), `DELETE` de toutes ses sessions, marquage `used_at`. 0 ligne mise à jour → `INVITATION_INVALID`.
  - `updatePasswordHash(db, userId, passwordHash)` → `true`
  - `setAdmin(db, userId, isAdmin)` → `true` ; retirer le rôle quand `countAdmins() === 1` et que ce compte est admin → `LAST_ADMIN`.
  - `listAccountStatuses(db, now)` → `Record<string, AccountStatus>` (clé `player_id` ; joueurs absents = `none`).

- [ ] **Étape 1 : tests qui échouent** (chaque test part de `createTestDb()` avec les joueurs `p1` « Alex » et `p2` « Bob » ; `now = new Date('2026-10-03T12:00:00Z')`)
  - `createUserFromInvitation crée le compte et consomme l'invitation` : après création, `getUserByUsername(db, 'ALEX')` renvoie le compte (pseudo créé « Alex ») ; `getValidInvitation` renvoie `null`.
  - `seconde utilisation de la même invitation → INVITATION_INVALID` et `SELECT COUNT(*) FROM users` vaut 1.
  - `invitation expirée → INVITATION_INVALID` (appel avec `now + 8 j`).
  - `nouvelle invitation annule la précédente` : deux `createInvitation` pour `p1` ; l'ancienne empreinte donne `null`, la nouvelle est valide.
  - `pseudo pris sans distinction de casse → USERNAME_TAKEN` (compte « Alex » pour p1, puis « alex » via invitation de p2).
  - `grant_admin donne is_admin` et `countAdmins` vaut 1.
  - `reset : change le hachage et supprime les sessions` (insérer 2 sessions SQL brutes pour le compte, vérifier 0 restante).
  - `reset refusé avec une invitation signup → INVITATION_INVALID`.
  - `setAdmin(false) sur le dernier admin → LAST_ADMIN` ; avec 2 admins → OK et `countAdmins` vaut 1.
  - `listAccountStatuses` : p1 `account` (avec pseudo), p2 `pending` après invitation, p3 sans rien absent ou `none`.

- [ ] **Étape 2 : lancer** `npx vitest run lib/db-auth.users.test.ts` → FAIL.
- [ ] **Étape 3 : implémenter** dans `lib/db-auth.ts`, en suivant le style de `lib/db-decks.ts` (`try/catch`, `ok`/`err`, `normalizeX`). Identifiants via `crypto.randomUUID()`, dates via `toISOString()`. Les violations d'unicité se reconnaissent au message contenant `UNIQUE constraint failed: users.username` / `users.player_id` (identique sur D1 et SQLite).
- [ ] **Étape 4 : lancer** → PASS. **Étape 5 : commit** `feat(auth): accès D1 comptes et invitations`

---

### Tâche 5 : Accès D1 — sessions, tentatives, decks

**Fichiers :** Modifier `lib/db-auth.ts`, `lib/db-decks.ts` ; Créer `lib/db-auth.sessions.test.ts`, `lib/db-decks.test.ts`

**Interfaces — Produit :**
- `type SessionRow = { id: string; user_id: string; expires_at: string; user: (DbUser & { player_name: string; avatar_url: string | null }) | null }`
- `insertSession(db, { idHash, userId, expiresAt })` → `true`
- `getSessionWithUser(db, idHash)` → `SessionRow | null` (`LEFT JOIN users` + `players`)
- `extendSession(db, idHash, expiresAt)` → `true`
- `deleteSession(db, idHash)` → `true`
- `deleteUserSessions(db, userId, exceptIdHash?: string)` → `true`
- `deleteExpiredSessions(db, now)` → `true`
- `countRecentFailures(db, username, now)` → `number` (fenêtre 15 min, `COLLATE NOCASE`)
- `recordFailure(db, username, now)` → `true` (supprime aussi les lignes de plus de 15 min, tous pseudos confondus)
- `clearFailures(db, username)` → `true`
- `lib/db-decks.ts` : `getDeck(db, id)` → `DbDeck | null` ; `updateDeck(db, id, { name?, moxfield_url?, commander_image_url? })` → `DbDeck` ; `isDeckUsedInLeague(db, id)` → `boolean` ; `deleteDeck(db, id)` → `true`, ou erreur `'DECK_IN_USE'` si utilisé dans une ligue.

- [ ] **Étape 1 : tests qui échouent**
  - `getSessionWithUser` renvoie la session et l'utilisateur joint (nom du joueur) ; `user` vaut `null` pour `user_id = 'bootstrap'`.
  - `deleteUserSessions(db, u, keep)` garde uniquement `keep`.
  - `deleteExpiredSessions` supprime seulement les sessions dont `expires_at <= now`.
  - `5 échecs → countRecentFailures = 5 ; à now + 16 min → 0` ; `clearFailures('ALEX')` efface les échecs enregistrés pour « alex ».
  - `deleteDeck refusé si league_players.deck_id le référence` (`DECK_IN_USE`, deck toujours présent) ; accepté sinon.
  - `updateDeck` ne modifie que les champs fournis (un champ explicitement `null` est vidé).
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(auth): sessions, anti-force brute, gestion des decks en base`

---

### Tâche 6 : Résolution de session

**Fichiers :** Créer `lib/auth/resolve.ts`, `lib/auth/resolve.test.ts`

**Interfaces :**
- Consomme : `hashToken` (T2), `getSessionWithUser`, `extendSession`, `deleteSession`, `countAdmins` (T4/T5), `CurrentUser` (T3).
- Produit :
  - `SESSION_TTL_MS = 30 * 24 * 3600 * 1000` ; `SESSION_EXTEND_THRESHOLD_MS = 29 * 24 * 3600 * 1000`
  - `BOOTSTRAP_USER_ID = 'bootstrap'`
  - `resolveSession(db: D1Database, token: string | undefined, now: Date): Promise<CurrentUser | null>`
  - Utilisateur de démarrage renvoyé : `{ id: 'bootstrap', playerId: '', username: 'admin', isAdmin: true, playerName: 'Admin (démarrage)', avatarUrl: null, isBootstrap: true }`.

- [ ] **Étape 1 : tests qui échouent**
  - jeton absent ou inconnu → `null`.
  - session valide → `CurrentUser` avec `playerName` et `isAdmin` corrects.
  - session expirée → `null` et la ligne est supprimée.
  - session dont le compte n'existe plus (joueur supprimé → compte supprimé en cascade) → `null` et la ligne est supprimée.
  - expiration dans 28 jours → repoussée à `now + 30 j` ; dans 29,5 jours → inchangée.
  - session de démarrage sans admin → utilisateur de démarrage ; **après création d'un compte admin, la même session → `null`** (point de vigilance 5).
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(auth): résolution de session`

---

### Tâche 7 : Services d'authentification

**Fichiers :** Créer `lib/auth/service.ts`, `lib/auth/service.test.ts`

**Interfaces :**
- Consomme : T2 à T6.
- Produit (toutes renvoient `Promise<ServiceResult<…>>`) :
  - `loginWithPassword(db, { username, password }, now)` → `{ userId: string }`
  - `loginBootstrap(db, { adminPassword }, envAdminPassword: string | undefined, now)` → `{ userId: 'bootstrap' }`
  - `acceptInvitation(db, token, { username?, password, passwordConfirm }, now)` → `{ userId: string }`
  - `changePassword(db, user: CurrentUser, { currentPassword, newPassword }, currentSessionIdHash: string)` → `true` (ferme les autres sessions)
  - `issueInvitation(db, { playerId, kind, grantAdmin }, now)` → `{ token: string; expiresAt: string }`
  - `openSession(db, userId, now)` → `{ token: string; expiresAt: Date }` (génère le jeton, insère son empreinte, appelle `deleteExpiredSessions`)

**Codes et messages :**

| Cas | Statut | Message |
|---|---|---|
| Pseudo inconnu / mauvais mot de passe | 401 | Pseudo ou mot de passe incorrect |
| 5 échecs en 15 min | 429 | Trop de tentatives, réessaie dans 15 minutes |
| Démarrage alors qu'un admin existe, ou `ADMIN_PASSWORD` absent | 403 | La connexion par mot de passe admin est désactivée |
| Démarrage : mauvais mot de passe | 401 | Mot de passe incorrect |
| Invitation invalide | 410 | Ce lien n'est plus valide, demande un nouveau lien à l'admin |
| Confirmation différente | 400 | Les mots de passe ne correspondent pas |
| Pseudo / mot de passe invalide | 400 | message de `validateUsername` / `validatePassword` |
| Pseudo pris | 409 | Ce pseudo est déjà utilisé |
| Joueur déjà doté d'un compte | 409 | Ce joueur a déjà un compte |
| Mot de passe actuel faux (`changePassword`) | 400 | Mot de passe actuel incorrect |
| `issueInvitation` signup avec compte existant / reset sans compte | 409 | Ce joueur a déjà un compte / Ce joueur n'a pas encore de compte |
| Joueur inexistant | 404 | Joueur introuvable |

- [ ] **Étape 1 : tests qui échouent**
  - connexion réussie avec « alex » pour un compte « Alex » (point de vigilance 1), et les échecs précédents de ce pseudo sont effacés.
  - pseudo inconnu et mauvais mot de passe → même statut 401 et même message.
  - 5 échecs puis le bon mot de passe → 429 ; à `now + 16 min` → succès.
  - démarrage : OK sans admin ; 403 dès qu'un admin existe ; 403 si `envAdminPassword` est `undefined` ; 401 si mauvais mot de passe.
  - `acceptInvitation` signup puis reset : chaque cas d'erreur du tableau a un test ; un reset réussi permet de se connecter avec le nouveau mot de passe.
  - `changePassword` : la session courante survit, les autres sont supprimées.
  - `issueInvitation` + `acceptInvitation` de bout en bout avec le jeton en clair renvoyé.
- [ ] **Étape 2 : lancer** → FAIL.
- [ ] **Étape 3 : implémenter.** Dans `loginWithPassword`, si le pseudo est inconnu, appeler `verifyDummyPassword` avant d'enregistrer l'échec. Le compteur d'échecs est vérifié **avant** la vérification du mot de passe.
- [ ] **Étape 4 : lancer** → PASS. **Étape 5 : commit** `feat(auth): services de connexion et d'invitation`

---

### Tâche 8 : Couche Next — session, middleware, routes d'authentification

**Fichiers :**
- Créer : `lib/auth/session.ts`, `lib/auth/session.test.ts`, `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts`, `app/api/auth/invitation/[token]/route.ts`
- Modifier : `lib/auth.ts` (devient `export * from './auth/session'`), `middleware.ts`
- Supprimer : `app/api/admin/login/route.ts`, `app/api/admin/logout/route.ts`

**Interfaces — Produit (`lib/auth/session.ts`) :**
- `SESSION_COOKIE = 'dc_session'`
- `getCurrentUser(): Promise<CurrentUser | null>` (enveloppé dans `cache` de React ; `getRequestContext().env.DB` + `cookies()` + `resolveSession`)
- `setSessionCookie(res: NextResponse, token: string, expiresAt: Date): void` ; `clearSessionCookie(res: NextResponse): void`
- `currentSessionIdHash(): Promise<string | null>`
- `requireUser(): Promise<CurrentUser | NextResponse>` (401 « Connexion requise ») ; `requireAdmin()` (403 « Accès réservé aux admins ») ; `requirePlayer()` = `requireUser` et refus 403 si `isBootstrap`.
- `isAdminAuthenticated(): Promise<boolean>` (`isAdmin` ou `isBootstrap`)
- `assertSameOrigin(req: Request): NextResponse | null` : 403 « Origine refusée » si l'en-tête `Origin` est présent et que son hôte diffère de l'hôte de `req.url`.

- [ ] **Étape 1 : test qui échoue** (`lib/auth/session.test.ts`, seule partie pure de ce fichier) : `assertSameOrigin` renvoie `null` sans en-tête `Origin` ou avec la même origine ; renvoie une réponse 403 pour `Origin: https://evil.com`.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter `session.ts`.**
- [ ] **Étape 4 : routes**
  - `login` : corps `{ username, password }` ou `{ adminPassword }` → services de T7 ; si succès, `openSession` puis `setSessionCookie` ; réponse `{ ok: true }`.
  - `logout` : `deleteSession` sur l'empreinte du cookie, `clearSessionCookie`.
  - `invitation/[token]` : `acceptInvitation`, puis `openSession` et cookie.
  - Chaque route mutante commence par `assertSameOrigin`.
- [ ] **Étape 5 : middleware** : `matcher: ['/admin/:path*', '/profil/:path*']` ; pas de cookie → redirection `/connexion?from=<pathname>` ; cookie présent → `NextResponse.next()` en reposant le même cookie avec `maxAge` 30 jours (sinon le cookie expirerait alors que la session est prolongée en base).
- [ ] **Étape 6 : vérifier** `npm test` → PASS et `npx tsc --noEmit` → aucune erreur (notamment, les routes admin existantes compilent toujours via le ré-export de `lib/auth.ts`).
- [ ] **Étape 7 : commit** `feat(auth): sessions par cookie, middleware et routes de connexion`

---

### Tâche 9 : Routes profil, decks et admin

**Fichiers :**
- Créer : `app/api/me/profile/route.ts`, `app/api/me/password/route.ts`, `app/api/decks/[id]/route.ts`, `app/api/admin/invitations/route.ts`, `app/api/admin/users/[id]/route.ts`
- Modifier : `app/api/players/[id]/decks/route.ts`, `lib/db.ts` (ajout de `updatePlayerProfile(db, id, { name?, avatar_url? })` → `DbPlayer`)
- Test : `lib/db.test.ts` (pour `updatePlayerProfile`)

**Interfaces — Consomme :** T5, T7, T8.

- [ ] **Étape 1 : test qui échoue** : `updatePlayerProfile` ne modifie que les champs fournis, et refuse un nom vide (erreur « Le nom est requis »).
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter `updatePlayerProfile`.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : routes** (toutes avec `assertSameOrigin` sur les méthodes mutantes)
  - `PATCH /api/me/profile` : `requirePlayer` ; `{ name?, avatar_url? }`, avec `avatar_url` vide transformé en `null` et accepté seulement s'il commence par `https://` (sinon 400 « L'avatar doit être une URL https »).
  - `PATCH /api/me/password` : `requirePlayer` ; `changePassword` avec `currentSessionIdHash()`.
  - `POST /api/players/[id]/decks` : remplacer la garde admin par `requireUser` + `canCreateDeckFor` (403 « Tu ne peux gérer que tes propres decks »).
  - `PATCH` / `DELETE /api/decks/[id]` : `requireUser`, `getDeck` (404 « Deck introuvable »), `canEditDeck` (403) ; `DECK_IN_USE` → 409 « Ce deck a été utilisé dans une ligue : renomme-le plutôt que de le supprimer ».
  - `POST /api/admin/invitations` : `requireAdmin` ; `issueInvitation` → `{ url: new URL('/invitation/' + token, req.url).toString(), expiresAt }`.
  - `PATCH /api/admin/users/[id]` : `requireAdmin` ; `setAdmin` ; `LAST_ADMIN` → 409 « Il doit rester au moins un admin ».
- [ ] **Étape 6 : vérifier** `npm test` et `npx tsc --noEmit` → OK.
- [ ] **Étape 7 : commit** `feat(auth): routes profil, decks et administration des comptes`

---

### Tâche 10 : Pages connexion, invitation et navigation

**Fichiers :**
- Créer : `app/connexion/page.tsx`, `app/connexion/LoginForm.tsx`, `app/invitation/[token]/page.tsx`, `app/invitation/[token]/InvitationForm.tsx`
- Modifier : `app/admin/login/page.tsx`, `app/layout.tsx`, `components/Navbar.tsx`

- [ ] **Étape 1 : `/connexion`** (serveur, `runtime = 'edge'`) : si déjà connecté → `redirect(safeRedirectPath(from))`. Affiche `LoginForm` (client, pseudo et mot de passe → `POST /api/auth/login` → `router.push(from)` puis `router.refresh()`). Si `countAdmins() === 0`, affiche aussi un bloc replié « Première configuration : mot de passe admin » qui envoie `{ adminPassword }` puis redirige vers `/admin`.
- [ ] **Étape 2 : `/invitation/[token]`** (serveur) : `getValidInvitation(hashToken(token), new Date())` ; si `null` → message « Ce lien n'est plus valide, demande un nouveau lien à l'admin. » ; sinon titre « Bienvenue <player_name> » et `InvitationForm` (`kind` en prop : pseudo affiché seulement pour `signup`) → `POST /api/auth/invitation/<token>` → `/profil`.
- [ ] **Étape 3 : `/admin/login`** → `redirect('/connexion?from=/admin')`.
- [ ] **Étape 4 : navigation** : `app/layout.tsx` devient `async`, appelle `getCurrentUser()` et passe `user` à `Navbar`. `Navbar` : « Admin » seulement si `user?.isAdmin` ; à droite, « Connexion » (icône `LogIn`) pour un visiteur, sinon avatar (ou initiale) + menu déroulant « Mon profil » (`/profil`), « Mes decks » (`/profil/decks`), « Déconnexion » (`POST /api/auth/logout`, puis `router.push('/')` et `router.refresh()`). Pour la session de démarrage, seuls « Admin » et « Déconnexion » apparaissent. Reprendre les classes Tailwind existantes (`dc-gold`, `dc-border`, etc.).
- [ ] **Étape 5 : vérifier** `npx tsc --noEmit` et `npm run lint` → OK.
- [ ] **Étape 6 : commit** `feat(auth): pages de connexion et d'invitation, navigation`

---

### Tâche 11 : Pages profil et mes decks

**Fichiers :** Créer `app/profil/page.tsx`, `app/profil/ProfileForms.tsx`, `app/profil/decks/page.tsx`, `app/profil/decks/MyDecks.tsx`

- [ ] **Étape 1 : `/profil`** (serveur) : `getCurrentUser()` ; `null` → `redirect('/connexion?from=/profil')` ; session de démarrage → `redirect('/admin')`. `ProfileForms` contient deux formulaires : « Profil » (nom affiché, URL d'avatar avec aperçu) → `PATCH /api/me/profile`, et « Mot de passe » (actuel, nouveau, confirmation, vérifiée côté client) → `PATCH /api/me/password`. Les messages de succès et d'erreur s'affichent dans la page.
- [ ] **Étape 2 : `/profil/decks`** : même garde ; `listPlayerDecks(db, user.playerId)` ; `MyDecks` permet de lister (image du commandant, nom, lien Moxfield), créer (`POST /api/players/<playerId>/decks`), modifier en place (`PATCH /api/decks/<id>`) et supprimer avec confirmation (`DELETE`, message 409 affiché tel quel).
- [ ] **Étape 3 : vérifier** `npx tsc --noEmit` et `npm run lint` → OK.
- [ ] **Étape 4 : commit** `feat(auth): pages profil et mes decks`

---

### Tâche 12 : Administration des comptes

**Fichiers :** Modifier `app/admin/page.tsx`, `app/admin/AdminDashboard.tsx`

- [ ] **Étape 1 : garde** : au début de `AdminPage`, `if (!(await isAdminAuthenticated())) redirect('/connexion?from=/admin')`. Charger `listAccountStatuses(db, new Date())` et `getCurrentUser()`, passés en props `accountStatuses` et `currentUserId`.
- [ ] **Étape 2 : tableau de bord** : pour chaque joueur de la liste existante, afficher un badge (« Pas de compte » / « Invitation en attente » / « @pseudo », avec la mention « admin » si besoin) et les actions :
  - `none` ou `pending` : bouton « Inviter » avec une case « admin » → `POST /api/admin/invitations` `{ kind: 'signup' }`.
  - `account` : bouton « Lien de réinitialisation » (`kind: 'reset'`), et un interrupteur « Admin » → `PATCH /api/admin/users/<userId>`.
  - Le lien renvoyé s'affiche dans un encart avec un bouton « Copier » (`navigator.clipboard.writeText`) et sa date d'expiration.
  - Les erreurs passent par le `showToast` existant.
- [ ] **Étape 3 : déconnexion** : `handleLogout` appelle `/api/auth/logout`.
- [ ] **Étape 4 : vérifier** `npx tsc --noEmit` et `npm run lint` → OK.
- [ ] **Étape 5 : commit** `feat(auth): gestion des comptes dans l'admin`

---

### Tâche 13 : Vérification finale

- [ ] **Étape 1 :** `npm test` → tous les tests passent (noter le nombre).
- [ ] **Étape 2 :** `npx tsc --noEmit` → aucune erreur ; `npm run lint` → aucune erreur. Le dépôt n'a pas de configuration ESLint : si `next lint` demande à en créer une de façon interactive, ne pas en ajouter dans ce sous-projet et signaler que le lint n'a pas pu tourner.
- [ ] **Étape 3 :** `npx @cloudflare/next-on-pages` → build réussi. Toutes les nouvelles routes et pages sont en `runtime = 'edge'`, sinon le build échoue.
- [ ] **Étape 4 : parcours manuel**, si l'environnement le permet. Lancer `npm run db:migrate:local`, puis `npx wrangler pages dev` avec `ADMIN_PASSWORD` dans `.dev.vars`. Dérouler : démarrage, invitation admin, création du compte, ancien mot de passe refusé, invitation d'un joueur, connexion avec un pseudo en casse différente, profil, création, modification et suppression d'un deck, refus sur le deck d'un autre, réinitialisation, retrait du rôle au dernier admin refusé. Si le parcours ne peut pas être exécuté, le dire et fournir cette liste à l'utilisateur.
- [ ] **Étape 5 :** mettre à jour le README : section « Comptes joueurs » avec les étapes de déploiement de la spec.
- [ ] **Étape 6 : commit et push** `docs: comptes joueurs dans le README`
