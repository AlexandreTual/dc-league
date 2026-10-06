# Mails : mot de passe oublié et invitations

Le site peut envoyer deux sortes de mails :

- le lien d'**invitation** (création de compte) et le lien de **réinitialisation** générés par l'admin ;
- le lien « **Mot de passe oublié ?** » demandé par un joueur depuis la page de connexion (valable 1 heure, 3 demandes par heure au plus).

Sans configuration, rien ne change : l'admin copie le lien et l'envoie lui-même (« Envoi de mails non configuré : copie le lien »).

Le service est choisi par les variables du site, sans toucher au code : `BREVO_API_KEY` → Brevo ; sinon `RESEND_API_KEY` → Resend ; sinon aucun envoi.

---

## Mise en place avec Brevo (maintenant)

Brevo est gratuit jusqu'à 300 mails par jour et accepte une adresse Gmail comme expéditeur.

### 1. Créer le compte

1. Ouvrir **brevo.com** → **Sign up free**.
2. Valider l'adresse du compte (mail de Brevo), puis remplir le profil demandé.

### 2. Ajouter et valider l'expéditeur

1. Menu en haut à droite (nom du compte) → **Senders, Domains & Dedicated IPs** → onglet **Senders**.
2. **Add sender** : nom « Commander League », adresse Gmail qui enverra les mails.
3. Ouvrir le mail reçu sur cette adresse Gmail et cliquer le lien de confirmation (ou saisir le code).

### 3. Créer la clé d'API

1. Menu en haut à droite → **SMTP & API** → onglet **API Keys**.
2. **Generate a new API key**, nom « dc-league ».
3. Copier la clé (elle commence par `xkeysib-`) : elle n'est montrée qu'une fois.

### 4. Donner la clé au site (Cloudflare Pages)

1. **dash.cloudflare.com** → **Workers & Pages** → le projet du site → **Settings** → **Variables and Secrets**.
2. **Add** trois fois, environnement **Production** :

   | Variable name | Type | Value |
   |---|---|---|
   | `BREVO_API_KEY` | **Secret** | la clé `xkeysib-…` |
   | `MAIL_FROM` | Text | l'adresse Gmail validée à l'étape 2 |
   | `MAIL_FROM_NAME` | Text | `Commander League` (facultatif, c'est la valeur par défaut) |

3. **Save**.
4. Onglet **Deployments** → sur le dernier déploiement, menu **⋯** → **Retry deployment** (les variables ne s'appliquent qu'aux nouveaux déploiements).

### 5. Base de données

La migration `0005_email.sql` (adresses mail, demandes, boîte de test) est appliquée automatiquement à la fusion sur `main`. Si l'Action **Déployer le Worker de jeu** a échoué : onglet **Actions** de GitHub → relancer, ou `npm run db:migrate:remote`.

### 6. Tester

1. Se connecter, ouvrir **Mon profil** → **Adresse mail** → saisir son adresse → **Enregistrer**.
2. Se déconnecter → **Connexion** → **Mot de passe oublié ?** → saisir son pseudo ou son adresse → **Envoyer le lien**.
3. Ouvrir le mail « Commander League — nouveau mot de passe » (**regarder les spams** la première fois et marquer « Non spam »), suivre le lien, choisir un nouveau mot de passe.
4. Côté admin : **Comptes joueurs** → saisir une adresse à côté d'« Inviter » → le message « Invitation envoyée à a…@gmail.com » doit s'afficher.

En cas d'« L'envoi a échoué » : vérifier la clé et `MAIL_FROM` (adresse exactement validée dans Brevo). Les journaux du site (Cloudflare → projet → **Deployments** → **View details** → **Functions** / **Real-time Logs**) indiquent `[mail] brevo : réponse 401` (clé refusée), `400` (expéditeur non validé) ou `délai dépassé`. La clé n'y apparaît jamais.

> Un expéditeur Gmail envoyé par Brevo atterrit parfois dans les spams : c'est la limite d'un envoi sans nom de domaine. Le passage à Resend avec un domaine (ci-dessous) règle ce point.

---

## Plus tard : passage à Resend avec un nom de domaine

1. Acheter un domaine (ex. chez Cloudflare : **Domain Registration** → **Register Domains**).
2. **resend.com** → **Sign up** → **Domains** → **Add Domain** → saisir le domaine.
3. Recopier les enregistrements DNS affichés (MX, TXT SPF, TXT DKIM) dans Cloudflare : le domaine → **DNS** → **Records** → **Add record**. Attendre que Resend affiche **Verified**.
4. Resend → **API Keys** → **Create API Key** (permission **Sending access**) → copier la clé (`re_…`).
5. Cloudflare Pages → **Settings** → **Variables and Secrets** :
   - ajouter `RESEND_API_KEY` (**Secret**) ;
   - modifier `MAIL_FROM` : une adresse du domaine, ex. `ligue@mon-domaine.fr` ;
   - **supprimer** `BREVO_API_KEY` (sinon Brevo reste prioritaire).
6. **Retry deployment**, puis refaire le test de l'étape 6.

---

## En local

Ajouter `MAIL_TEST=1` dans `.dev.vars` (jamais en production) : les mails ne partent pas, ils sont écrits dans la table `test_mails` et lisibles sur `http://localhost:8788/api/test/mails` (404 sans `MAIL_TEST=1`).

Vérification de bout en bout dans un navigateur :

```bash
node scripts/mail-check.mjs http://localhost:8788 <dossier-captures>
```
