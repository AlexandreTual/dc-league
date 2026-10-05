# Design — Mots de passe oubliés et invitations par mail

**Date :** 2026-10-05
**Statut :** En relecture
**Projet :** comptes joueurs (suite de `2026-10-03-player-accounts-design.md`)

---

## Contexte

Les comptes sont créés sur invitation : l'admin génère un lien de création de compte (7 jours) ou de réinitialisation, puis le transmet lui-même. Un joueur — ou l'admin — qui oublie son mot de passe ne peut rien faire seul : l'admin s'est déjà retrouvé bloqué.

But : envoyer ces liens par mail et offrir un « Mot de passe oublié ? » en libre-service, sans nom de domaine pour l'instant (site en `pages.dev`), avec un passage simple à un domaine plus tard.

## Décisions prises avec l'utilisateur

| Sujet | Décision |
|---|---|
| Service d'envoi | Brevo maintenant (expéditeur : une adresse Gmail validée) ; Resend quand un domaine sera acheté ; choix par configuration, sans changer le code |
| Adresse mail | facultative, unique, sur le compte ; saisie par le joueur (profil) ou par l'admin (invitation) ; pas de mail de confirmation |
| Mot de passe oublié | par pseudo ou adresse ; réponse identique que le compte existe ou non ; lien valable 1 h ; 3 demandes par heure et par compte |
| Sans service configuré | fonctionnement actuel : lien à copier côté admin |

## Hors périmètre

Confirmation de l'adresse par mail ; notifications de jeu par mail (matchs, parties) ; changement de pseudo ; achat et configuration du domaine.

---

## 1. Données (migration `0005_email.sql`)

```sql
ALTER TABLE users ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email COLLATE NOCASE) WHERE email IS NOT NULL;
ALTER TABLE invitations ADD COLUMN email TEXT;
CREATE TABLE IF NOT EXISTS password_requests (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_requests_user ON password_requests(user_id, requested_at);
-- Boîte de test (MAIL_TEST=1, en local seulement) ; reste vide en production.
CREATE TABLE IF NOT EXISTS test_mails (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  text       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

- L'adresse est enregistrée nettoyée (espaces retirés) ; comparaison sans casse.
- La durée d'un lien reste portée par `invitations.expires_at` : `createInvitation` reçoit la durée (7 jours pour l'admin, 1 h pour le libre-service).
- `password_requests` sert uniquement à la limite de 3 demandes par heure ; les lignes de plus d'une heure sont effacées à chaque demande.

## 2. Saisie de l'adresse

- **Profil** (`/profil`) : champ « Adresse mail » (ajout, modification, effacement). Bandeau discret tant qu'il est vide : « Ajoute ton adresse mail pour pouvoir récupérer ton mot de passe ».
- **Admin, invitation** : champ « Adresse mail » facultatif à côté d'« Inviter ». L'adresse est gardée sur l'invitation puis copiée sur le compte à sa création (`createUserFromInvitation`).
- **Validation** : format `x@y.z` (une seule `@`, pas d'espace, 254 caractères au plus) ; adresse déjà portée par un autre compte → « Cette adresse est déjà utilisée ».
- **Visibilité** : le joueur voit la sienne ; l'admin voit celles de tous dans « Comptes joueurs » ; jamais sur les pages publiques ni dans les réponses d'API publiques.

## 3. Parcours

### a) Invitation par l'admin

1. L'admin saisit (ou non) une adresse et clique « Inviter ».
2. Le lien est créé comme aujourd'hui (7 jours).
3. Avec une adresse et un service configuré : envoi du mail « invitation ». Retour : `{ url, expiresAt, mail: 'sent' | 'failed' | 'disabled' | 'none' }`.
4. Affichage : `sent` → « Invitation envoyée à a…@gmail.com » ; `failed` → « L'envoi a échoué » ; `disabled` → « Envoi de mails non configuré » ; dans tous les cas le lien reste affiché avec « Copier ».

### b) Lien de réinitialisation par l'admin

Bouton actuel. Si le compte a une adresse, envoi du mail « réinitialisation » (7 jours) ; même retour `mail` et même affichage qu'en a).

### c) Mot de passe oublié (libre-service)

- Lien « Mot de passe oublié ? » sur `/connexion` → page `/mot-de-passe-oublie` : un champ « Pseudo ou adresse mail ».
- `POST /api/auth/forgot` `{ identifier }` (contrôle d'origine comme les autres routes d'authentification) :
  1. Recherche du compte par pseudo, puis par adresse (sans casse).
  2. Si le compte existe, a une adresse et a fait moins de 3 demandes dans l'heure : enregistrement de la demande, création d'un lien `reset` valable **1 h** (annule le lien non utilisé précédent), envoi du mail « mot de passe oublié ».
  3. Réponse **toujours** `200 { ok: true }`, quel que soit le cas (inconnu, sans adresse, limite atteinte, échec d'envoi) ; les échecs d'envoi sont journalisés côté serveur.
- Message affiché : « Si un compte correspond et a une adresse mail, un lien vient d'être envoyé. Il est valable 1 heure. Pense à regarder tes spams. Pas d'adresse sur ton compte ? Demande un lien à l'admin. »
- Le lien mène à la page existante `/invitation/[token]` (choix du mot de passe). Après réinitialisation, les sessions du compte sont fermées (déjà le cas dans `resetPasswordFromInvitation`).

## 4. Envoi des mails (`lib/mail/`)

```ts
type Mail = { to: string; subject: string; text: string; html: string }
type MailResult = 'sent' | 'failed' | 'disabled'
function mailerFromEnv(env, fetch): { send(mail: Mail): Promise<MailResult> }
```

- Choix du service : `BREVO_API_KEY` présent → Brevo ; sinon `RESEND_API_KEY` → Resend ; sinon `MAIL_TEST=1` → boîte de test ; sinon désactivé (`disabled`).
- **Brevo** : `POST https://api.brevo.com/v3/smtp/email`, en-tête `api-key`, corps `{ sender: { name, email }, to: [{ email }], subject, textContent, htmlContent }`.
- **Resend** : `POST https://api.resend.com/emails`, en-tête `Authorization: Bearer <clé>`, corps `{ from: "Nom <adresse>", to: [adresse], subject, text, html }`.
- Expéditeur : `MAIL_FROM` (obligatoire pour Brevo et Resend ; absent → `disabled`) et `MAIL_FROM_NAME` (« Commander League » par défaut).
- Délai maximal 10 s ; réponse non 2xx, délai dépassé ou erreur réseau → `failed` (journalisé, sans la clé).
- **Boîte de test** (`MAIL_TEST=1`, à ne mettre que dans `.dev.vars`) : les mails sont écrits dans une table `test_mails` (créée par la migration, vide en production) et lisibles par `GET /api/test/mails`, qui répond 404 si `MAIL_TEST` n'est pas `1`.
- **Modèles** (`lib/mail/templates.ts`) : `invitationMail`, `adminResetMail`, `forgotMail` ; chacun produit `{ subject, text, html }` en français, avec le nom du joueur (échappé en HTML), le bouton/lien et sa durée de validité. Exemple (mot de passe oublié) :
  - Sujet : « Commander League — nouveau mot de passe »
  - Texte : « Bonjour Ana, voici ton lien pour choisir un nouveau mot de passe (valable 1 heure) : <lien>. Si tu n'as rien demandé, ignore ce mail. »
- `cloudflare-env.d.ts` : ajout de `BREVO_API_KEY?`, `RESEND_API_KEY?`, `MAIL_FROM?`, `MAIL_FROM_NAME?`, `MAIL_TEST?`.

## 5. Documentation

- `docs/mails.md`, pas à pas et lisible sur téléphone :
  1. créer un compte Brevo gratuit ;
  2. ajouter et valider l'expéditeur (adresse Gmail) ;
  3. créer une clé API (SMTP & API → API Keys) ;
  4. dans Cloudflare Pages (Settings → Variables and Secrets) : `BREVO_API_KEY` (secret), `MAIL_FROM`, `MAIL_FROM_NAME` ; redéployer ;
  5. appliquer la migration `0005` sur la base en ligne ;
  6. tester « Mot de passe oublié ? » ;
  7. plus tard, passage à Resend avec un domaine : enregistrements DNS, `RESEND_API_KEY`, nouveau `MAIL_FROM`, suppression de `BREVO_API_KEY`.
- README, section « Comptes joueurs » : mot de passe oublié et invitations par mail.

## 6. Tests

- **Unitaires**
  - `mailerFromEnv` : choix Brevo / Resend / test / désactivé ; `MAIL_FROM` manquant → `disabled`.
  - Appels Brevo et Resend : adresse, en-têtes et corps exacts (fetch simulé) ; réponse 4xx/5xx, délai dépassé, erreur réseau → `failed`.
  - Modèles : lien présent dans le texte et le HTML ; nom contenant `<script>` échappé dans le HTML.
  - Adresse : validation, nettoyage, doublon (sans casse) refusé.
  - Mot de passe oublié : par pseudo, par adresse (casse différente), inconnu, compte sans adresse, 4ᵉ demande dans l'heure (aucun lien, aucun mail), demande après une heure de nouveau acceptée, lien expiré après 1 h, ancien lien annulé par le nouveau ; réponse identique dans tous les cas.
  - Invitation avec adresse : mail envoyé, adresse copiée sur le compte créé ; retour `mail` pour chaque cas.
- **Navigateur** (`scripts/mail-check.mjs`, site local avec `MAIL_TEST=1`) : un joueur ajoute son adresse dans son profil ; « Mot de passe oublié ? » par adresse ; lien lu dans la boîte de test ; nouveau mot de passe ; connexion réussie avec lui, échec avec l'ancien ; l'admin invite avec une adresse, le joueur crée son compte depuis le mail et retrouve l'adresse dans son profil ; aucune erreur JavaScript.
- **Après déploiement (utilisateur)** : configuration Brevo selon `docs/mails.md`, puis un vrai « Mot de passe oublié ? ».

## Fichiers

- Créer : `migrations/0005_email.sql`, `lib/mail/index.ts`, `lib/mail/templates.ts` et leurs tests, `app/mot-de-passe-oublie/page.tsx` (+ formulaire), `app/api/auth/forgot/route.ts`, `app/api/test/mails/route.ts`, `scripts/mail-check.mjs`, `docs/mails.md`.
- Modifier : `lib/db-auth.ts` (adresse, invitations avec adresse et durée, demandes), `lib/auth/service.ts` (mot de passe oublié, invitations), `lib/auth/validation.ts` (adresse), `app/api/admin/invitations/route.ts`, route du profil, `components/admin/AccountsPanel.tsx`, page profil, `app/connexion/LoginForm.tsx`, `cloudflare-env.d.ts`, `README.md`, `docs/superpowers/roadmap.md`.
