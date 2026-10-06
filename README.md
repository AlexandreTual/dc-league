# Commander League

Site de ligue Magic (Commander) entre amis : classement, ligues et playoffs, historique, comptes joueurs sur invitation, decks importés, mode test solo et parties en ligne à 2–5 joueurs.

Stack : **Next.js 15** (App Router, runtime edge) sur **Cloudflare Pages** via `@cloudflare/next-on-pages` · base **Cloudflare D1** · **Worker + Durable Object** pour les parties en ligne · **Tailwind CSS** · tests **Vitest**.

---

## Organisation du code

| Dossier | Rôle |
|---|---|
| `app/` | Pages et routes d'API (toutes en `runtime = 'edge'`) |
| `components/` | Composants ; `components/table/` = la table de jeu (mode test et jeu en ligne) |
| `lib/auth/` | Comptes, sessions, invitations |
| `lib/cards/` | Import de decks (texte, liens Moxfield/Archidekt), Scryfall, cartes en français |
| `lib/game/` | Moteur de partie pur (`applyAction`, `canApply`, `viewFor`) |
| `workers/game/` | Worker + Durable Object des parties en ligne |
| `migrations/` | Migrations D1 numérotées (`000N_nom.sql`) |
| `scripts/` | Correctifs `postinstall`, données de test, vérifications navigateur |
| `docs/` | Déploiement du jeu en ligne, specs et plans (`docs/superpowers/`), feuille de route |

---

## Développement local

Prérequis : Node.js 22.

```bash
npm install                 # applique aussi les correctifs de scripts/patch-next-on-pages.mjs
npm run db:migrate:local    # crée la base D1 locale
```

Variables locales dans `.dev.vars` (non versionné) : `ADMIN_PASSWORD`, mot de passe de démarrage utilisé tant qu'aucun compte admin n'existe.

Lancer le site comme en production (build Cloudflare puis serveur local) :

```bash
npx @cloudflare/next-on-pages
npm run game:dev &                      # serveur de jeu, port 8787
npx wrangler pages dev --port 8788      # site (relancer après chaque build)
```

`npm run dev` (Next seul) fonctionne aussi pour l'interface, avec les liaisons Cloudflare simulées.

Données de test (joueurs `e2e-1`…`e2e-4`, cookie `dc_session` = `jeton-de-test-<id>`, decks `deck-<id>`) :

```bash
node scripts/seed-online.mjs > /tmp/seed.sql && npx wrangler d1 execute dc-league --local --file /tmp/seed.sql
```

---

## Vérifications

```bash
npm test                          # Vitest (D1 simulé par test/d1.ts)
npx tsc --noEmit                  # types du site
npx tsc -p workers/game --noEmit  # types du Worker de jeu
npm run lint                      # ESLint (eslint-config-next, règles react-hooks)
npx @cloudflare/next-on-pages     # build Cloudflare Pages
```

La CI (`.github/workflows/ci.yml`) lance ces vérifications sur chaque pull request.

Vérifications dans un navigateur (playwright-core + Chromium, site et serveur de jeu lancés) :

```bash
node scripts/playtest-check.mjs http://localhost:8788 <deckId> <dossier>   # mode test
node scripts/online-check.mjs http://localhost:8788 <dossier>              # partie en ligne
node scripts/deck-link-check.mjs http://localhost:8788 <dossier>           # import par lien
```

---

## Mise en production

- **Site** : Cloudflare Pages construit le site à chaque fusion sur `main` (`npx @cloudflare/next-on-pages`, sortie `.vercel/output/static`, voir `wrangler.toml`).
- **Base D1** : les migrations sont appliquées en production automatiquement à chaque fusion sur `main`, par `.github/workflows/deploy-game-worker.yml`. En cas d'échec de l'Action : `npm run db:migrate:remote`.
- **Jeu en ligne** : le Worker `workers/game` est déployé par `.github/workflows/deploy-game-worker.yml`. Mise en ligne, secrets à créer et développement local : voir [docs/deploiement-jeu-en-ligne.md](docs/deploiement-jeu-en-ligne.md).

Les consignes de travail (méthode, règles, commandes) sont dans [CLAUDE.md](CLAUDE.md) ; l'avancement dans [docs/superpowers/roadmap.md](docs/superpowers/roadmap.md).
