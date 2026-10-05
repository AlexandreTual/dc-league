# Mots de passe oubliés et invitations par mail — plan d'implémentation

**But :** envoyer les liens d'invitation et de réinitialisation par mail (Brevo maintenant, Resend plus tard) et offrir un « Mot de passe oublié ? » en libre-service.

**Architecture :** un module `lib/mail/` (choix du service par les variables d'environnement, modèles de mails) appelé par `lib/auth/service.ts`, qui reçoit un `Mailer` et l'adresse du site ; les routes construisent le `Mailer` depuis `env`. L'adresse mail vit sur `users.email` et, avant la création du compte, sur `invitations.email`.

**Technologies :** Next.js 15 (edge), D1, Vitest (`test/d1.ts`), playwright-core.

**Spec :** `docs/superpowers/specs/2026-10-05-email-accounts-design.md`

## Contraintes globales

- Lien d'invitation et de réinitialisation par l'admin : **7 jours** (`INVITATION_TTL_MS` existant). Lien « mot de passe oublié » : **1 heure**.
- Au plus **3** demandes « mot de passe oublié » par compte et par heure.
- `POST /api/auth/forgot` répond toujours `200 { ok: true }`.
- Message libre-service : « Si un compte correspond et a une adresse mail, un lien vient d'être envoyé. Il est valable 1 heure. Pense à regarder tes spams. Pas d'adresse sur ton compte ? Demande un lien à l'admin. »
- Messages d'erreur : « Adresse mail invalide », « Cette adresse est déjà utilisée ».
- Service : `BREVO_API_KEY` → Brevo ; sinon `RESEND_API_KEY` → Resend ; sinon `MAIL_TEST=1` → boîte de test ; sinon désactivé. `MAIL_FROM` absent → désactivé (sauf boîte de test). `MAIL_FROM_NAME` par défaut « Commander League ». Délai d'envoi maximal 10 s.
- Les adresses ne sortent jamais dans une page ou une API publique ; la clé d'API n'apparaît jamais dans les journaux.

## Points de vigilance

1. **« ` Ana@Gmail.com ` » saisi dans « mot de passe oublié »** doit trouver le compte enregistré avec `ana@gmail.com`. → test en Tâche 3.
2. **Effacer son adresse dans le profil** enregistre `NULL`, pas une chaîne vide (sinon deux comptes « vides » se heurteraient à l'unicité). → test en Tâche 1.
3. **Invitation avec une adresse déjà portée par un compte** : refusée dès l'invitation (409). Si l'adresse a été prise entre l'invitation et la création du compte, le compte est créé **sans** adresse plutôt que d'échouer. → tests en Tâches 1 et 3.
4. **4ᵉ demande dans l'heure** : aucun nouveau lien (l'ancien reste valable), aucun mail, même réponse. → test en Tâche 3.
5. **Échec d'envoi en libre-service** : la demande compte quand même dans la limite, la réponse reste `{ ok: true }`. → test en Tâche 3.

---

### Tâche 1 : Base de données et validation de l'adresse

**Fichiers :**
- Créer : `migrations/0005_email.sql` (contenu exact : spec §1, y compris `test_mails`)
- Modifier : `test/d1.ts` (ajouter `0005_email.sql` à `MIGRATIONS`), `lib/db-auth.ts`, `lib/auth/validation.ts`
- Tests : `lib/db-auth.email.test.ts`, `lib/auth/validation.test.ts`

**Interfaces :**
- Produit (`validation.ts`) : `normalizeEmail(s: string | null | undefined): string | null` (espaces retirés, chaîne vide → `null`) ; `validateEmail(s: string): string | null` (→ `'Adresse mail invalide'` si pas exactement une `@`, espace, pas de `.` après la `@`, ou plus de 254 caractères).
- Produit (`db-auth.ts`) :
  - `DbUser.email: string | null` ; `AccountStatus` : `account` gagne `email: string | null`, `pending` gagne `email: string | null`.
  - `AUTH_ERR.EMAIL_TAKEN` ; `uniqueViolation` reconnaît `idx_users_email`.
  - `getUserByEmail(db, email): Promise<Result<DbUser | null>>` (sans casse).
  - `setUserEmail(db, userId, email: string | null): Promise<Result<true>>` (`EMAIL_TAKEN` si prise).
  - `createInvitation(db, { idHash, playerId, kind, grantAdmin, now, ttlMs, email? })` — `ttlMs` remplace la durée fixe ; `email` stockée sur l'invitation.
  - `createUserFromInvitation` copie `invitations.email` sur le compte sauf si un autre compte la porte déjà (alors `NULL`).
  - `countPasswordRequests(db, userId, now): Promise<Result<number>>` (dernière heure) ; `recordPasswordRequest(db, userId, now): Promise<Result<true>>` (efface d'abord les lignes de plus d'une heure, tous comptes).
  - `insertTestMail(db, { to, subject, text }): Promise<Result<true>>` ; `listTestMails(db): Promise<Result<{ to: string; subject: string; text: string; created_at: string }[]>>` (20 derniers, plus récent d'abord).

- [ ] **Étape 1 : tests qui échouent**
  - `validation.test.ts` : `normalizeEmail('  a@b.fr ')` → `'a@b.fr'` ; `normalizeEmail('  ')` → `null` ; `validateEmail` accepte `ana@gmail.com`, refuse `ana`, `ana@`, `a@b`, `a b@c.fr`, `a@@b.fr`, une adresse de 255 caractères.
  - `db-auth.email.test.ts` : `setUserEmail` puis `getUserByEmail('ANA@gmail.com')` trouve le compte ; même adresse (autre casse) sur un 2ᵉ compte → `EMAIL_TAKEN` ; `setUserEmail(null)` deux fois sur deux comptes → OK ; invitation `signup` avec `email` puis `createUserFromInvitation` → `user.email` = l'adresse ; adresse prise entre-temps → compte créé, `email` `null` ; `createInvitation` avec `ttlMs: 3600_000` → `expiresAt` = now + 1 h ; `recordPasswordRequest` ×3 puis `countPasswordRequests` → 3, à now + 61 min → 0 ; `insertTestMail` ×2 puis `listTestMails` → plus récent d'abord ; `listAccountStatuses` renvoie `email` pour `account` et `pending`.
- [ ] **Étape 2 :** `npx vitest run lib/db-auth.email.test.ts lib/auth/validation.test.ts` → échec.
- [ ] **Étape 3 :** migration, fonctions ci-dessus ; mettre à jour les appels existants de `createInvitation` (`ttlMs: INVITATION_TTL_MS`).
- [ ] **Étape 4 :** `npm test` et `npx tsc --noEmit` → tout passe.
- [ ] **Étape 5 : commit** `feat(auth): adresse mail des comptes et des invitations`

### Tâche 2 : Module d'envoi et modèles de mails

**Fichiers :**
- Créer : `lib/mail/index.ts`, `lib/mail/templates.ts`, `lib/mail/index.test.ts`, `lib/mail/templates.test.ts`
- Modifier : `cloudflare-env.d.ts` (`BREVO_API_KEY?`, `RESEND_API_KEY?`, `MAIL_FROM?`, `MAIL_FROM_NAME?`, `MAIL_TEST?` : `string`)

**Interfaces :**
- Consomme : `insertTestMail` (Tâche 1).
- Produit :
  - `type Mail = { to: string; subject: string; text: string; html: string }`
  - `type MailResult = 'sent' | 'failed' | 'disabled'`
  - `type Mailer = { send(mail: Mail): Promise<MailResult> }`
  - `type MailEnv = { BREVO_API_KEY?: string; RESEND_API_KEY?: string; MAIL_FROM?: string; MAIL_FROM_NAME?: string; MAIL_TEST?: string }`
  - `mailerFromEnv(env: MailEnv, deps: { fetch: typeof fetch; db?: D1Database }): Mailer`
  - `disabledMailer: Mailer` (renvoie toujours `'disabled'`, pour les tests et les routes sans configuration)
  - `invitationMail({ name, url }): Omit<Mail, 'to'>` — sujet « Commander League — ton invitation », « valable 7 jours »
  - `adminResetMail({ name, url })` — sujet « Commander League — nouveau mot de passe », « valable 7 jours »
  - `forgotMail({ name, url })` — sujet « Commander League — nouveau mot de passe », « valable 1 heure », « Si tu n'as rien demandé, ignore ce mail. »

- [ ] **Étape 1 : tests qui échouent**
  - Choix : clé Brevo + `MAIL_FROM` → appel à `https://api.brevo.com/v3/smtp/email` avec en-tête `api-key` et corps `{ sender: { name: 'Commander League', email }, to: [{ email }], subject, textContent, htmlContent }` ; clé Resend seule → `https://api.resend.com/emails`, `Authorization: Bearer <clé>`, corps `{ from: 'Commander League <adresse>', to: [adresse], subject, text, html }` ; les deux clés → Brevo ; `MAIL_FROM_NAME` pris en compte ; aucune clé → `'disabled'` sans appel ; clé sans `MAIL_FROM` → `'disabled'` ; `MAIL_TEST='1'` sans clé → mail écrit en base (`listTestMails`) et `'sent'`.
  - Échecs : réponse 400, 500, rejet réseau, délai dépassé (fetch qui ne répond jamais, faux minuteurs ou `AbortSignal` vérifié dans l'appel) → `'failed'` ; la clé n'apparaît pas dans `console.error` (espion).
  - Modèles : l'URL figure dans `text` et `html` ; durée attendue présente ; `name: '<script>x</script>'` → `html` contient `&lt;script&gt;` et pas `<script>`.
- [ ] **Étape 2 :** `npx vitest run lib/mail` → échec.
- [ ] **Étape 3 :** implémenter ; HTML en ligne simple (fond sombre, bouton doré), échappement `& < > " '`.
- [ ] **Étape 4 :** `npx vitest run lib/mail` et `npx tsc --noEmit` → OK.
- [ ] **Étape 5 : commit** `feat(mail): envoi par Brevo ou Resend et modèles de mails`

### Tâche 3 : Service — invitations envoyées et mot de passe oublié

**Fichiers :**
- Modifier : `lib/auth/service.ts`, `lib/auth/service.test.ts`
- Créer : `lib/auth/forgot.test.ts`

**Interfaces :**
- Consomme : Tâches 1 et 2.
- Produit :
  - `type MailContext = { mailer: Mailer; baseUrl: string }` (`baseUrl` : origine du site, ex. `https://dc-league.pages.dev`)
  - `issueInvitation(db, input: { playerId; kind; grantAdmin; email?: string | null }, now, ctx: MailContext): Promise<ServiceResult<{ url: string; expiresAt: string; mail: MailResult | 'none' }>>` — `url` = `${baseUrl}/invitation/${token}` ; `signup` : adresse de `input.email` (validée : 400 « Adresse mail invalide », déjà portée par un compte : 409 « Cette adresse est déjà utilisée ») ; `reset` : adresse du compte, `input.email` ignoré ; `'none'` s'il n'y a pas d'adresse.
  - `requestPasswordReset(db, identifier: string, now, ctx: MailContext): Promise<void>` — ne lève jamais d'erreur ; pseudo d'abord, puis adresse (`normalizeEmail`) ; compte sans adresse → rien ; `countPasswordRequests >= 3` → rien ; sinon `recordPasswordRequest`, invitation `reset` de 1 h (`FORGOT_TTL_MS = 3600_000`), `forgotMail` ; résultat `'failed'` ou `'disabled'` → `console.error('[forgot]', …)` sans adresse ni jeton.
  - `updateEmail(db, user: CurrentUser, email: string | null): Promise<ServiceResult<{ email: string | null }>>` — `normalizeEmail` puis `validateEmail` (400) ; `EMAIL_TAKEN` → 409.

- [ ] **Étape 1 : tests qui échouent** (mailer simulé qui garde les mails reçus et renvoie un résultat choisi)
  - `service.test.ts` (appels existants mis à jour avec `{ mailer: disabledMailer, baseUrl: 'https://site.test' }`) : invitation avec adresse → un mail `invitationMail` à cette adresse, `mail: 'sent'`, `url` commence par `https://site.test/invitation/` ; sans adresse → `'none'`, aucun mail ; mailer `'failed'` → `'failed'` et lien quand même valide ; adresse invalide → 400 ; adresse déjà portée → 409 ; `reset` d'un compte avec adresse → `adminResetMail`, `expiresAt` = now + 7 jours ; `updateEmail('  ')` → `email: null`.
  - `forgot.test.ts` : par pseudo → 1 mail, lien utilisable par `acceptInvitation` ; par `' ANA@Gmail.com '` → 1 mail ; inconnu → 0 mail ; compte sans adresse → 0 mail ; 4ᵉ demande dans l'heure → 3 mails seulement et le lien du 3ᵉ mail reste valable ; demande à now + 61 min → acceptée ; lien utilisé à now + 61 min → `acceptInvitation` 410 ; nouveau lien → l'ancien renvoie 410 ; mailer `'failed'` → la demande compte (3 échecs puis la 4ᵉ n'appelle plus le mailer) et `console.error` ne contient ni adresse ni jeton.
- [ ] **Étape 2 :** `npx vitest run lib/auth` → échec.
- [ ] **Étape 3 :** implémenter dans `service.ts`.
- [ ] **Étape 4 :** `npm test`, `npx tsc --noEmit` → OK.
- [ ] **Étape 5 : commit** `feat(auth): invitations par mail et mot de passe oublié`

### Tâche 4 : Routes et interface

**Fichiers :**
- Créer : `app/api/auth/forgot/route.ts`, `app/api/me/email/route.ts`, `app/api/test/mails/route.ts`, `app/mot-de-passe-oublie/page.tsx`, `app/mot-de-passe-oublie/ForgotForm.tsx`, `lib/mail/env.ts`
- Modifier : `app/api/admin/invitations/route.ts`, `components/admin/AccountsPanel.tsx`, `app/profil/page.tsx`, `app/profil/ProfileForms.tsx`, `app/connexion/LoginForm.tsx`, page admin qui fournit les statuts (afficher l'adresse)

**Interfaces :**
- Consomme : Tâches 2 et 3.
- Produit :
  - `lib/mail/env.ts` : `mailContext(req: Request): MailContext` — `mailerFromEnv(env, { fetch, db: env.DB })`, `baseUrl = new URL(req.url).origin`.
  - `POST /api/admin/invitations` `{ player_id, kind, grant_admin?, email? }` → `201 { url, expiresAt, mail }`.
  - `PATCH /api/me/email` `{ email: string | null }` → `200 { email }` | 400 | 409 (même contrôle d'origine et de connexion que `/api/me/profile`).
  - `POST /api/auth/forgot` `{ identifier }` → toujours `200 { ok: true }` (contrôle d'origine ; identifiant vide → `200` sans rien faire).
  - `GET /api/test/mails` → `404` si `env.MAIL_TEST !== '1'`, sinon `200 { mails }` (`listTestMails`).
- Libellés : lien « Mot de passe oublié ? » sous le formulaire de connexion ; page « Mot de passe oublié » avec champ « Pseudo ou adresse mail » et bouton « Envoyer le lien », puis le message des contraintes globales ; profil : section « Adresse mail » (champ, « Enregistrer », bandeau « Ajoute ton adresse mail pour pouvoir récupérer ton mot de passe » si vide) ; admin : champ « Adresse mail (facultatif) » à côté d'« Inviter », adresse affichée sous le pseudo des comptes, et selon `mail` : « Invitation envoyée à a…@gmail.com » / « Lien envoyé à a…@gmail.com » (réinitialisation), « L'envoi a échoué : copie le lien », « Envoi de mails non configuré : copie le lien » ; le lien reste toujours affiché. Masquage : premier caractère de la partie locale puis `…@domaine`.

- [ ] **Étape 1 :** routes et interface ; `testid` : `forgot-done`, `email-banner`, `invite-mail-status`.
- [ ] **Étape 2 :** `npm test`, `npx tsc --noEmit`, build `npx @cloudflare/next-on-pages` → OK ; `scripts/playtest-check.mjs` → 32 ✓ (non-régression).
- [ ] **Étape 3 : commit** `feat(auth): pages mot de passe oublié, adresse mail du profil et invitations par mail`

### Tâche 5 : Vérification de bout en bout et documentation

**Fichiers :**
- Créer : `scripts/mail-check.mjs`, `docs/mails.md`
- Modifier : `README.md` (section « Comptes joueurs » : mot de passe oublié, invitations par mail, `MAIL_TEST=1` dans `.dev.vars` en local), `docs/superpowers/roadmap.md`

- [ ] **Étape 1 :** `scripts/mail-check.mjs` (site local avec `MAIL_TEST=1` dans `.dev.vars`, migration `0005` appliquée en local, données `seed-online`). Préparation par `wrangler d1 execute --local` : Ana (`e2e-1`) admin avec un mot de passe connu, adresses effacées, joueur `e2e-5` « Émile » sans compte, boîte de test vidée. Scénario : Ana ajoute `ana@example.test` dans son profil ; déconnexion ; « Mot de passe oublié ? » avec `ANA@example.test` → `forgot-done` ; lien lu via `GET /api/test/mails` ; nouveau mot de passe ; connexion avec le nouveau réussie, avec l'ancien refusée ; identifiant inconnu → même message, aucun nouveau mail ; Ana invite Émile avec `emile@example.test` → « Invitation envoyée à e…@example.test » ; Émile ouvre le lien du mail, crée son compte et voit `emile@example.test` dans son profil ; aucune erreur JavaScript.
- [ ] **Étape 2 :** `docs/mails.md` (contenu : spec §5), lisible sur téléphone, avec les libellés anglais de Brevo et de Cloudflare.
- [ ] **Étape 3 :** `node scripts/mail-check.mjs` → « Tout est OK » ; `npm test`, `tsc`, build → OK ; capture de la page « Mot de passe oublié » et du profil sur téléphone, envoyées à l'utilisateur.
- [ ] **Étape 4 : commit et push** `test(auth): mails vérifiés de bout en bout, documentation Brevo` ; feuille de route : chantier terminé, migration `0005` et configuration Brevo à faire en production.
