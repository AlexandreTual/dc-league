# Commander League — guide pour les agents

Site de ligue Magic (Commander) entre amis : classement, ligues, decks importés, mode test solo et parties en ligne à 2–5 joueurs.
Le propriétaire travaille surtout depuis son téléphone : **réponses, commits, docs et interface en français**.

## Avant de commencer une issue

1. Lire l'issue, puis le plan et la spec qu'elle cite (`docs/superpowers/plans/`, `docs/superpowers/specs/`).
2. Vérifier que les issues dont elle dépend sont fermées (sinon s'arrêter et le dire).
3. Partir de `main` à jour, sur la branche indiquée par la session.
4. Faire **uniquement** la tâche de l'issue ; tout écart de conception se discute dans l'issue avant d'être codé.

## Méthode

- Tests d'abord (Vitest), puis le code minimal, puis la vérification complète ci-dessous.
- Un commit par tâche, message en français au format `type(portée): résumé` (ex. `feat(auth): …`, `fix(table): …`, `docs: …`).
- PR qui ferme l'issue (`Closes #N`), description en français : changements, vérifications faites, ce qui reste à tester par l'utilisateur.
- Mettre à jour `docs/superpowers/roadmap.md` quand une tâche termine un chantier.
- Ne jamais inventer un comportement absent de la spec : demander dans l'issue.

## Vérifications avant de pousser

```bash
npm test                      # Vitest (D1 simulé par test/d1.ts, migrations appliquées dans l'ordre)
npx tsc --noEmit
npx @cloudflare/next-on-pages # build Cloudflare Pages
```

Navigateur (playwright-core, Chromium : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) :

```bash
npm run db:migrate:local
node scripts/seed-online.mjs > /tmp/seed.sql && npx wrangler d1 execute dc-league --local --file /tmp/seed.sql
npm run game:dev &                                  # serveur de jeu, port 8787
npx wrangler pages dev --port 8788 &                # site (relancer après chaque build)
node scripts/playtest-check.mjs http://localhost:8788 <deckId> <dossier>   # mode test (32 vérifications)
node scripts/online-check.mjs http://localhost:8788 <dossier>              # partie en ligne
node scripts/deck-link-check.mjs http://localhost:8788 <dossier>           # import par lien
```

Comptes de test (`scripts/seed-online.mjs`) : joueurs `e2e-1`…`e2e-4` (Ana, Bastien, Chloé, Damien), cookie `dc_session` = `jeton-de-test-<id>`, decks `deck-<id>`.

## Architecture (repères)

- Next.js 15 en runtime edge sur Cloudflare Pages (`@cloudflare/next-on-pages` épinglé, patché au `postinstall`), base D1 (`migrations/`), Tailwind.
- `lib/auth/` : comptes, sessions, invitations (`service.ts` = logique, `lib/db-auth.ts` = requêtes).
- `lib/cards/` : import de decks (texte, liens Moxfield/Archidekt), Scryfall, cartes en français.
- `lib/game/` : moteur de partie pur (`applyAction`, `canApply`, `viewFor` sans fuite d'information cachée), menus, rangées.
- `workers/game/` : Worker + Durable Object des parties en ligne (déployé par `.github/workflows/deploy-game-worker.yml`).
- `components/table/` : la table de jeu, commune au mode test (source locale) et au jeu en ligne (source distante).

## Règles à respecter

- Aucune donnée d'une carte cachée ne doit atteindre le navigateur d'un joueur qui ne la voit pas.
- Les messages d'erreur affichés sont en français.
- Les migrations sont numérotées (`000N_nom.sql`) et ajoutées à `MIGRATIONS` dans `test/d1.ts`. Elles sont appliquées en production **automatiquement** à la fusion sur `main`, par `.github/workflows/deploy-game-worker.yml` (avant le déploiement du Worker de jeu) : l'utilisateur n'a rien à lancer. Le signaler quand même dans la PR, avec deux précautions :
  - le site (Cloudflare Pages) se déploie en parallèle et peut tourner une à deux minutes sur l'ancienne base : le nouveau code doit tolérer ce court décalage (au pire une erreur propre, jamais une donnée perdue) ;
  - si l'Action échoue, la migration n'est pas appliquée : l'utilisateur la relance depuis l'onglet Actions, ou lance `npm run db:migrate:remote`.
- Pas de nouveau secret ou service externe sans le documenter (`docs/`) avec les étapes pour l'utilisateur.
- L'interface doit supporter un serveur de jeu plus ancien : l'aperçu d'une PR (et le site juste après une fusion) parle au Worker de jeu de production, redéployé seulement à la fusion sur `main`. Tout nouveau champ de l'état de partie (`PlayerView`, `ViewMessage`…) peut donc manquer côté navigateur : le traiter comme facultatif dans `components/` (ne rien afficher plutôt que planter). Pour vérifier : lancer `npm run game:dev` depuis un `git worktree` de `main` et ouvrir une partie en ligne avec le site de la branche.
