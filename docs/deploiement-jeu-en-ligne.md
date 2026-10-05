# Mettre en ligne le jeu en ligne

Le jeu en ligne a besoin d'un second programme à côté du site : le **Worker de jeu** (`workers/game`), qui garde les parties en cours. Le site, lui, continue de se déployer comme avant.

Le Worker se déploie tout seul grâce à une GitHub Action (`.github/workflows/deploy-game-worker.yml`), à chaque fusion sur `main` qui le concerne. Elle applique aussi les migrations de la base (dont `0004_game_tables.sql`).

Il faut seulement lui donner, **une fois**, deux secrets. Tout se fait depuis le navigateur du téléphone.

---

## 1. Créer un jeton d'API Cloudflare

Le tableau de bord Cloudflare est en anglais :

1. Ouvre [dash.cloudflare.com](https://dash.cloudflare.com) et connecte-toi.
2. Icône du profil (en haut à droite) → **Profile** → **API Tokens** → **Create Token**.
3. Ligne **Edit Cloudflare Workers** → **Use template**.
4. Section **Permissions** : sous les lignes déjà présentes, **+ Add more**, puis règle la nouvelle ligne sur **Account** | **D1** | **Edit**. (Les Durable Objects sont couverts par la ligne `Workers Scripts` | `Edit` du modèle.)
5. **Account Resources** : **Include** + ton compte. **Zone Resources** : laisse **All zones**.
6. **Continue to summary** → **Create Token**, puis **copie le jeton** (il ne sera plus affiché).

## 2. Trouver l'identifiant du compte

Menu de gauche → **Workers & Pages** : l'**Account ID** est affiché sur la droite (sur téléphone, plus bas dans la page), avec un bouton pour le copier. C'est aussi la longue suite de caractères dans l'adresse : `dash.cloudflare.com/<identifiant>/…`.

## 3. Ajouter les secrets dans GitHub

1. Ouvre le dépôt sur GitHub → **Settings** → **Secrets and variables** → **Actions**.
2. **New repository secret** :
   - nom `CLOUDFLARE_API_TOKEN`, valeur : le jeton de l'étape 1 ;
   - nom `CLOUDFLARE_ACCOUNT_ID`, valeur : l'identifiant de l'étape 2.

## 4. Premier déploiement

1. Fusionne la pull request du jeu en ligne sur `main` : l'Action **« Déployer le Worker de jeu »** se lance (onglet **Actions** du dépôt). On peut aussi la lancer à la main : **Actions** → **Déployer le Worker de jeu** → **Run workflow**.
2. Attends qu'elle soit verte.
3. Le site Pages a pu se construire **avant** que le Worker existe : dans Cloudflare → **Workers & Pages** → projet **dc-league** → onglet **Deployments**, sur le dernier déploiement : menu **⋯** → **Retry deployment**.

## 5. Vérifier

- Le lien **Salon** apparaît dans le menu quand tu es connecté.
- Crée une table, fais-la rejoindre par un ami (ou un second compte dans une fenêtre privée), choisissez vos decks, démarre : la partie s'affiche chez les deux et une pioche de l'un se voit chez l'autre.
- En cas de souci : onglet **Actions** de GitHub (journal du déploiement), ou Cloudflare → **Workers & Pages** → **dc-league-game** → **Logs**.

---

## Développement local

```bash
npm install                                  # applique aussi le correctif WebSocket de next-on-pages
npm run db:migrate:local                     # base locale, migrations 0001 à 0004
npm run game:dev                             # Worker de jeu sur le port 8787
npx @cloudflare/next-on-pages && npx wrangler pages dev --port 8788   # le site, relié au Worker
```

Test de bout en bout (4 navigateurs) :

```bash
node scripts/seed-online.mjs > /tmp/seed-online.sql
npx wrangler d1 execute dc-league --local --file /tmp/seed-online.sql
node scripts/online-check.mjs http://localhost:8788 /tmp
```

## À savoir

- `scripts/patch-next-on-pages.mjs` corrige next-on-pages (qui perdait la connexion WebSocket) à chaque `npm install`. La version de `@cloudflare/next-on-pages` est figée : en cas de mise à jour, le script s'arrête avec un message si le code visé a changé. Il corrige aussi un défaut de Next 15.5 (la page `app/not-found.tsx` perdait le runtime edge, ce qui faisait échouer le build) ; si ce code-là change, il se contente d'un avertissement.
- Les tables sans activité depuis 7 jours sont supprimées chaque nuit par le Worker.
