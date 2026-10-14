# Mails : mot de passe oublié et invitations

Le site peut envoyer deux sortes de mails :

- le lien d'**invitation** (création de compte) et le lien de **réinitialisation** générés par l'admin ;
- le lien « **Mot de passe oublié ?** » demandé par un joueur depuis la page de connexion (valable 1 heure, 3 demandes par heure au plus).

Sans configuration, rien ne change : l'admin copie le lien et l'envoie lui-même (« Envoi de mails non configuré : copie le lien »).

Le service est choisi par les variables du site, sans toucher au code : `RESEND_API_KEY` et `MAIL_FROM` → Resend (le jour où il y a un nom de domaine) ; sinon `GOOGLE_SCRIPT_URL` et `GOOGLE_SCRIPT_SECRET` → script Google ; sinon aucun envoi.

---

## Mise en place avec ta Gmail (maintenant)

Les mails partent **de ta propre Gmail**, par un petit script Google (Google Apps Script) que le site appelle avec un mot de passe partagé. C'est gratuit, sans autre compte, et les mails arrivent moins souvent en spam qu'avec un service qui se ferait passer pour ta Gmail.

- Limite Google : environ **100 destinataires par jour** pour un compte Gmail gratuit.
- Expéditeur affiché : « Commander League » avec ton adresse Gmail.
- L'éditeur de script est pénible sur téléphone : sur un ordinateur, c'est 5 minutes. Sur téléphone, ouvrir Chrome en mode **Version pour ordinateur**.

### 1. Choisir le mot de passe partagé

Une suite d'au moins 16 caractères, lettres et chiffres, sans espace ni apostrophe (ex. généré par ton gestionnaire de mots de passe). Il sert deux fois : dans le script (étape 2) et dans Cloudflare (étape 5). Ne le donne à personne, pas même dans une issue ou une conversation.

### 2. Créer le script

1. Ouvrir **script.google.com** avec le compte Gmail qui enverra les mails → **New project**.
2. En haut, cliquer **Untitled project** et le renommer `Commander League mails`.
3. Dans `Code.gs`, **tout effacer**, puis coller le code ci-dessous.
4. Remplacer `REMPLACE-MOI` par ton mot de passe (en gardant les apostrophes autour).
5. Enregistrer (icône disquette).

```js
// Relais d'envoi des mails de Commander League depuis ta Gmail (docs/mails.md).
// À coller tel quel dans script.google.com, puis à déployer en « Web app ».
// Remplace seulement le mot de passe ci-dessous : le même que GOOGLE_SCRIPT_SECRET dans Cloudflare.
const SECRET = 'REMPLACE-MOI'

function doPost(e) {
  let data
  try {
    data = JSON.parse(e.postData.contents)
  } catch {
    return reply({ ok: false, error: 'requete' })
  }
  if (SECRET === 'REMPLACE-MOI' || SECRET.length < 16 || data.secret !== SECRET) {
    return reply({ ok: false, error: 'secret' })
  }
  try {
    MailApp.sendEmail({ to: data.to, subject: data.subject, body: data.text, htmlBody: data.html, name: data.name })
  } catch {
    return reply({ ok: false, error: MailApp.getRemainingDailyQuota() < 1 ? 'quota' : 'envoi' })
  }
  return reply({ ok: true })
}

function reply(result) {
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON)
}

// À lancer une fois depuis l'éditeur (bouton « Run ») : autorise l'envoi et t'envoie un mail d'essai.
function essai() {
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Commander League — essai', 'Le relais de mails fonctionne.')
}
```

(Le même code est dans le dépôt : `scripts/google-apps-script-mail.js`.)

### 3. Autoriser l'envoi et tester

1. Dans la barre du haut, choisir la fonction **essai**, puis **Run**.
2. **Review permissions** → choisir ton compte.
3. Google affiche « Google hasn't verified this app » : c'est normal, c'est ton propre script. **Advanced** → **Go to Commander League mails (unsafe)** → **Allow**.
4. Tu dois recevoir le mail « Commander League — essai ».

### 4. Publier le script

1. En haut à droite : **Deploy** → **New deployment**.
2. Roue dentée à côté de **Select type** → **Web app**.
3. Remplir :
   - **Description** : `Commander League`
   - **Execute as** : **Me** (ton adresse)
   - **Who has access** : **Anyone** (le site n'a pas de compte Google ; c'est le mot de passe qui protège le script)
4. **Deploy**, puis copier la **Web app URL** (elle commence par `https://script.google.com/macros/s/` et finit par `/exec`).

### 5. Donner l'adresse et le mot de passe au site (Cloudflare Pages)

1. **dash.cloudflare.com** → **Workers & Pages** → le projet du site → **Settings** → **Variables and Secrets**.
2. **Add**, environnement **Production** :

   | Variable name | Type | Value |
   |---|---|---|
   | `GOOGLE_SCRIPT_URL` | Text | la Web app URL de l'étape 4 |
   | `GOOGLE_SCRIPT_SECRET` | **Secret** | le mot de passe de l'étape 1 |
   | `MAIL_FROM_NAME` | Text | `Commander League` (facultatif, c'est la valeur par défaut) |

3. **Save**.
4. Onglet **Deployments** → sur le dernier déploiement, menu **⋯** → **Retry deployment** (les variables ne s'appliquent qu'aux nouveaux déploiements).

### 6. Base de données

La migration `0005_email.sql` (adresses mail, demandes, boîte de test) est appliquée automatiquement à la fusion sur `main`. Si l'Action **Déployer le Worker de jeu** a échoué : onglet **Actions** de GitHub → relancer, ou `npm run db:migrate:remote`.

### 7. Tester

1. Se connecter, ouvrir **Mon profil** → **Adresse mail** → saisir son adresse → **Enregistrer**.
2. Se déconnecter → **Connexion** → **Mot de passe oublié ?** → saisir son pseudo ou son adresse → **Envoyer le lien**.
3. Ouvrir le mail « Commander League — nouveau mot de passe » (regarder les spams la première fois), suivre le lien, choisir un nouveau mot de passe.
4. Côté admin : **Comptes joueurs** → saisir une adresse à côté d'« Inviter » → le message « Invitation envoyée à a…@gmail.com » doit s'afficher.

### En cas de problème

- « Envoi de mails non configuré » : une des deux variables manque, ou l'adresse ne commence pas par `https://script.google.com/` (le site refuse d'envoyer le mot de passe ailleurs). Vérifier aussi le **Retry deployment**.
- « L'envoi a échoué » : regarder les journaux du site (Cloudflare → projet → **Deployments** → **View details** → **Functions** / **Real-time Logs**). Le mot de passe n'y apparaît jamais.
  - `[mail] google : refus (secret)` : le mot de passe du script et `GOOGLE_SCRIPT_SECRET` diffèrent, ou il est resté à `REMPLACE-MOI`, ou il fait moins de 16 caractères.
  - `[mail] google : réponse illisible` : **Who has access** n'est pas **Anyone**, ou l'adresse n'est pas celle du déploiement (`/exec`).
  - `[mail] google : refus (quota)` : limite de Google atteinte pour la journée ; réessayer demain.
  - `[mail] google : refus (envoi)` : Gmail a refusé ce mail (adresse du destinataire invalide, le plus souvent).
- **Modifier le script plus tard** : après l'avoir enregistré, **Deploy** → **Manage deployments** → crayon → **Version** : **New version** → **Deploy**. L'adresse reste la même, rien à changer dans Cloudflare.

---

## Plus tard : passage à Resend avec un nom de domaine

1. Acheter un domaine (ex. chez Cloudflare : **Domain Registration** → **Register Domains**).
2. **resend.com** → **Sign up** → **Domains** → **Add Domain** → saisir le domaine.
3. Recopier les enregistrements DNS affichés (MX, TXT SPF, TXT DKIM) dans Cloudflare : le domaine → **DNS** → **Records** → **Add record**. Attendre que Resend affiche **Verified**.
4. Resend → **API Keys** → **Create API Key** (permission **Sending access**) → copier la clé (`re_…`).
5. Cloudflare Pages → **Settings** → **Variables and Secrets** :
   - ajouter `RESEND_API_KEY` (**Secret**) ;
   - ajouter `MAIL_FROM` (Text) : une adresse du domaine, ex. `ligue@mon-domaine.fr`.

   Resend passe alors avant le script Google : `GOOGLE_SCRIPT_URL` et `GOOGLE_SCRIPT_SECRET` peuvent rester (secours si Resend est retiré) ou être supprimés.
6. **Retry deployment**, puis refaire le test de l'étape 7.

---

## En local

Ajouter `MAIL_TEST=1` dans `.dev.vars` (jamais en production) : les mails ne partent pas, ils sont écrits dans la table `test_mails` et lisibles sur `http://localhost:8788/api/test/mails` (404 sans `MAIL_TEST=1`).

Vérification de bout en bout dans un navigateur :

```bash
node scripts/mail-check.mjs http://localhost:8788 <dossier-captures>
```
