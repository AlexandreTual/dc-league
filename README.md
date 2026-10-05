# Commander League Manager

Application web de gestion de ligue Duel Commander entre amis.
Stack : **Next.js 14 App Router** · **Supabase** · **Tailwind CSS** · **Docker**

---

## Fonctionnalités

- **Classement en temps réel** — points (V=3, N=1, D=0) + diff de manches (GW−GL)
- **Calendrier Round Robin** — matchs groupés par rounds
- **Page de règles** — format, proxys, banlist
- **Dashboard admin** protégé par mot de passe :
  - Ajouter / supprimer des joueurs
  - Générer automatiquement tous les matchs (Round Robin)
  - Saisir les scores en 1 clic (modal de sélection BO3)
  - Réinitialiser un score ou toute la ligue

---

## Démarrage rapide

### 1. Prérequis

- Node.js 20+
- Un projet [Supabase](https://supabase.com) (gratuit)

### 2. Configurer Supabase

Dans l'éditeur SQL de ton projet Supabase, exécute le fichier :

```
supabase/schema.sql
```

### 3. Variables d'environnement

Copie `.env.example` en `.env.local` et remplis les valeurs :

```bash
cp .env.example .env.local
```

| Variable | Où la trouver | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Settings > API | URL du projet |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Settings > API | Clé publique (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Settings > API | Clé secrète (service_role) ⚠️ |
| `ADMIN_PASSWORD` | Ton choix | Mot de passe du dashboard admin |

> ⚠️ **La `SUPABASE_SERVICE_ROLE_KEY` est secrète.** Ne jamais la committer ni l'exposer côté client. Elle n'est utilisée que par les API routes Next.js (serveur).

### 4. Développement local

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

---

## Déploiement Docker (Koyeb)

### Build local

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -t dc-app .

docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e ADMIN_PASSWORD=... \
  dc-app
```

### Avec docker-compose

```bash
# Copier et remplir les variables
cp .env.example .env

docker compose up -d
```

### Sur Koyeb

1. Pusher l'image sur un registry (Docker Hub, ghcr.io...)
2. Dans Koyeb > Services > New Service > Docker
3. Ajouter les 4 variables d'environnement dans les settings Koyeb
4. Exposer le port `3000`

> Les variables `NEXT_PUBLIC_*` doivent aussi être passées comme **build arguments** si tu utilises le CI/CD Koyeb (elles sont baked dans le bundle Next.js au build).

---

## Comptes joueurs

Chaque joueur a un compte personnel (pseudo + mot de passe), créé **uniquement sur invitation**. L'admin est un rôle porté par un compte.

### Mise en place (une seule fois)

1. Appliquer la migration : `npm run db:migrate:remote`
2. Déployer.
3. Aller sur `/connexion`, ouvrir « Première configuration » et entrer `ADMIN_PASSWORD`.
4. Dans l'admin, section **Comptes joueurs** : cocher « admin » sur ton joueur, cliquer **Inviter**, ouvrir le lien et créer ton compte.
   Dès qu'un compte admin existe, `ADMIN_PASSWORD` ne fonctionne plus (la variable peut être retirée de Cloudflare).
5. Inviter les autres joueurs de la même façon et leur envoyer le lien (valable 7 jours, usage unique).

### Au quotidien

- **Mot de passe oublié** : bouton « Lien de réinitialisation » sur le joueur, dans l'admin.
- **Mon profil** (`/profil`) : nom affiché, avatar, mot de passe.
- **Mes decks** (`/profil/decks`) : chaque joueur gère ses propres decks ; un deck déjà utilisé dans une ligue peut être renommé mais pas supprimé.

### Développement local

```bash
npm run db:migrate:local
echo 'ADMIN_PASSWORD=secret-local' > .dev.vars
npx @cloudflare/next-on-pages && npx wrangler pages dev
npm test   # tests unitaires (Vitest)
```

---

## Import de decks

Chaque joueur importe la liste de ses decks depuis **Mes decks** (`/profil/decks`) → « Importer la liste ».

- **Format accepté** : export texte de Moxfield (Arena / MTGO), une carte par ligne : `1 Sol Ring`, `1x Sol Ring` ou `1 Sol Ring (C21) 263`. Sections reconnues : `Commander`, `Deck` ; `Sideboard`, `Maybeboard`, `Considering` et `Tokens` sont ignorées.
- Les cartes sont complétées via **Scryfall**, en **français** quand une impression française existe (même édition en priorité), sinon en anglais. Un cache en base rend les imports suivants quasi instantanés.
- Page publique **Voir le deck** (`/decks/<id>`) : cartes par type, image au survol ou au toucher, bascule FR/EN, choix du commandant.

Mise en place : `npm run db:migrate:remote` (applique `migrations/0003_deck_cards.sql`), puis déployer.

---

## Mode test

Sur la page d'un deck importé (`/decks/<id>`), le bouton **Tester le deck** ouvre un plateau de test solo (`/decks/<id>/test`), pensé pour l'ordinateur.

- **Glisser-déposer** entre main, champ de bataille, bibliothèque (Maj = dessous), cimetière, exil et zone de commandement.
- **Double-clic** : engager une carte du champ de bataille, piocher depuis la bibliothèque, poser une carte de la main.
- **Clic droit** sur une carte : engager, retourner, face cachée, marqueurs, taxe du commandant, envoyer vers une zone. Sur la bibliothèque : piocher, mélanger, regarder les X du dessus, chercher, révéler. Clic sur le cimetière ou l'exil : voir la pile.
- **Jetons** : recherche Scryfall ou jeton personnalisé. **Journal** et statistiques de la partie.
- **Raccourcis** : `D` piocher, `U` tout dégager, `N` tour suivant, `S` mélanger, `M` mulligan, `Ctrl+Z` annuler, `Échap` fermer.
- Mulligan à la londonienne, **premier mulligan gratuit**. Taxe de commandant comptée automatiquement.
- La partie est **sauvegardée dans le navigateur** et peut être reprise ; elle est ignorée si le deck a été réimporté.

Vérification dans un navigateur : `node scripts/playtest-check.mjs <url> <deckId> <dossier-captures>` (Chromium requis).

---

## Guide d'utilisation

### Démarrer une ligue

1. Aller sur `/admin` (mot de passe requis)
2. Ajouter les joueurs (Nom + lien Moxfield)
3. Cliquer **Générer la ligue** → tous les matchs Round Robin sont créés
4. Partager le lien de l'app avec les joueurs

### Saisir un score

1. Dans `/admin`, cliquer sur un match "À jouer"
2. Sélectionner le score BO3 (2-0 / 2-1 / 1-1 / 1-2 / 0-2)
3. Valider → classement mis à jour immédiatement

### Classement et tie-breaker

- **Victoire** : 3 points | **Nul** (1-1) : 1 point chacun | **Défaite** : 0 point
- Départage : **différence de manches** (GW − GL, i.e. game wins minus game losses)
- Les 4 premiers se qualifient pour le Top 4

---

## Structure du projet

```
dc-app/
├── app/
│   ├── page.tsx              # Classement (home)
│   ├── calendar/page.tsx     # Calendrier des matchs
│   ├── rules/page.tsx        # Règles
│   ├── admin/
│   │   ├── page.tsx          # Server component (fetch data)
│   │   ├── AdminDashboard.tsx # Client component (interactif)
│   │   └── login/page.tsx
│   └── api/
│       ├── admin/login/      # Auth cookie
│       ├── admin/logout/
│       ├── players/          # GET / POST / DELETE
│       └── matches/
│           ├── generate/     # POST (génère Round Robin) / DELETE (reset)
│           └── [id]/         # PATCH (score) / DELETE (reset score)
├── components/
│   ├── Navbar.tsx
│   ├── LeaderboardTable.tsx
│   ├── MatchCard.tsx
│   └── ScoreModal.tsx
├── lib/
│   ├── supabase.ts           # Client browser (anon key)
│   ├── supabase-server.ts    # Client serveur (service_role key)
│   ├── auth.ts               # Cookie helpers
│   └── leaderboard.ts        # Calcul classement + génération Round Robin
├── middleware.ts             # Protection des routes /admin/*
├── supabase/schema.sql       # Script SQL à exécuter dans Supabase
├── Dockerfile
├── docker-compose.yml
└── .env.example
```
# dc-league

---

## Jeu en ligne

Le jeu en ligne (salon, parties à 2–5 en direct) repose sur un Worker Cloudflare séparé (`workers/game`).
Mise en ligne, secrets à créer et développement local : voir [docs/deploiement-jeu-en-ligne.md](docs/deploiement-jeu-en-ligne.md).
