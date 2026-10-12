# Design — Ligues créées et gérées par les joueurs (plusieurs ligues en parallèle)

**Date :** 2026-10-12
**Statut :** validé en conversation (12 octobre)
**Chantier :** partie 1 de la refonte des ligues (issue générale, reprend #17)

---

## Contexte

Aujourd'hui le site n'a qu'**une seule ligue active**, pour tout le monde :
- `createLeague` refuse une nouvelle ligue tant qu'une autre est active (`lib/db-leagues.ts`) ;
- toutes les pages Ligue (classement, calendrier, playoffs) et l'accueil lisent `getActiveLeague` ;
- seul l'admin gère la ligue, depuis `/admin` (création, inscriptions, decks, matchs, scores, playoffs, clôture).

On veut que **tout compte joueur puisse créer sa ligue et la gérer**, plusieurs ligues pouvant tourner en même temps.

## Découpage de la refonte

| Partie | Sujet | Spec |
|---|---|---|
| **1** | Plusieurs ligues, chacune gérée par son organisateur (round-robin actuel) | ce document |
| 1 bis | Format rondes suisses pour les ligues nombreuses | à concevoir |
| 2 | Scores saisis par les joueurs ; match en physique ou en ligne | à concevoir |
| 3 | Match de ligue en ligne en BO3, score inscrit à la fin | à concevoir (ex-sous-projet 4 du jeu en ligne) |

Cette spec ne couvre que la partie 1. Le format reste celui d'aujourd'hui : round-robin en duel (scores BO3 saisis), puis playoffs à 4 (demi-finales, finale, petite finale) s'il y a au moins 4 inscrits.

## Décisions

1. **Création** : tout compte joueur (pas la session de démarrage) crée une ligue avec un **nom** et une **visibilité**. Il en devient l'**organisateur** et y est inscrit d'office (il peut se désinscrire depuis la gestion s'il ne joue pas). Il peut y avoir autant de ligues actives qu'on veut, et un joueur peut être inscrit dans plusieurs.
2. **Gestion** : l'organisateur fait sur *sa* ligue tout ce que l'admin fait aujourd'hui : inscrire et désinscrire (avant la génération des matchs), choisir le deck d'un inscrit, générer ou réinitialiser les matchs, saisir ou effacer un score, générer ou réinitialiser les playoffs, clôturer, supprimer. Un **admin du site** peut faire tout cela sur **toutes** les ligues.
3. **Entrer dans une ligue**, de deux façons :
   - l'organisateur ajoute un joueur parmi les comptes existants ;
   - **lien d'invitation** : l'organisateur copie un lien `/ligues/rejoindre/<jeton>` qu'il partage ; un joueur connecté qui l'ouvre voit le nom de la ligue et un bouton « Rejoindre ». Le lien peut être **renouvelé** (l'ancien cesse de marcher).
   - Dans les deux cas, impossible une fois les matchs générés (même règle qu'aujourd'hui).
   - **Il faut déjà un compte** : un visiteur non connecté qui ouvre le lien est envoyé à la connexion (`/connexion?from=…`), avec le message « Pas encore de compte ? Demande une invitation à l'administrateur. »
4. **Visibilité**, choisie à la création et modifiable ensuite par l'organisateur :
   - **publique** : visible par tout le monde, visiteurs compris ;
   - **privée** : visible seulement par ses inscrits, son organisateur et les admins. Pour tout autre visiteur, les pages de la ligue répondent « introuvable » (404), sans révéler qu'elle existe.
5. **Deck d'un inscrit** : le joueur choisit lui-même son deck pour la ligue parmi ses decks importés (sur la page de la ligue). L'organisateur et l'admin peuvent aussi le choisir, comme aujourd'hui l'admin.
6. **Désinscription par le joueur lui-même** : possible tant que les matchs ne sont pas générés (« Quitter la ligue »).
7. **Suppression** : l'organisateur peut supprimer sa ligue tant qu'aucun match n'a de score ; l'admin, toujours (comportement actuel).
8. **Ligues existantes** : elles deviennent **publiques** et **sans organisateur** (`owner_player_id` nul), donc gérées par les admins comme aujourd'hui. Aucune donnée n'est perdue.

## Modèle de données — migration `0013_user_leagues.sql`

```sql
ALTER TABLE leagues ADD COLUMN owner_player_id TEXT REFERENCES players(id) ON DELETE SET NULL;
ALTER TABLE leagues ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'private'));
ALTER TABLE leagues ADD COLUMN invite_token TEXT;          -- jeton du lien, NULL = pas encore créé
CREATE UNIQUE INDEX IF NOT EXISTS idx_leagues_invite ON leagues(invite_token);
CREATE INDEX IF NOT EXISTS idx_leagues_owner ON leagues(owner_player_id);
CREATE INDEX IF NOT EXISTS idx_league_players_player ON league_players(player_id);
```

- `is_active` garde son sens (en cours / archivée) ; la règle « une seule active » disparaît de `createLeague`.
- Le jeton d'invitation est aléatoire (`crypto.randomUUID()` sans tirets), stocké tel quel : il ne donne accès qu'à « rejoindre cette ligue », pas à un compte.
- La migration s'ajoute à `MIGRATIONS` dans `test/d1.ts`.

**Décalage de déploiement** (le site peut tourner une ou deux minutes sur l'ancienne base, ou l'inverse) : les nouvelles colonnes ont des valeurs par défaut, et l'ancien code ne les lit pas. Le nouveau code ne doit pas planter si elles manquent pendant ce court instant : au pire une erreur de chargement propre.

## Droits — module pur `lib/leagues/access.ts`

```ts
type Viewer = { playerId: string; isAdmin: boolean } | null   // null = visiteur
canViewLeague(league, viewer, isMember): boolean
canManageLeague(league, viewer): boolean   // admin, ou organisateur
```

Toutes les pages et routes passent par ces deux fonctions (testées seules). Une route de gestion répond 404 si la ligue est invisible pour l'appelant, et 403 si elle est visible mais pas gérable par lui.

## Adresses (approche retenue : la ligue dans l'adresse)

| Adresse | Contenu |
|---|---|
| `/ligues` | Liste : « Mes ligues » (inscrit ou organisateur), puis « Ligues publiques en cours », puis « Ligues terminées » (publiques, et privées dont on est membre). Bouton « Créer une ligue ». |
| `/ligues/nouvelle` | Formulaire : nom, visibilité (publique par défaut). |
| `/ligues/<id>` | Redirige vers `/ligues/<id>/classement`. |
| `/ligues/<id>/classement` | Classement (page actuelle `/classement`), en-tête avec nom, organisateur, visibilité, et pour un inscrit le choix de son deck et « Quitter la ligue ». |
| `/ligues/<id>/calendrier` | Calendrier (page actuelle `/calendar`). |
| `/ligues/<id>/playoffs` | Playoffs (onglet visible une fois lancés). |
| `/ligues/<id>/gerer` | Gestion, pour l'organisateur et l'admin : les panneaux actuels de `/admin` (en-tête, participants, round-robin, playoffs), plus le lien d'invitation (copier, renouveler) et la visibilité. |
| `/ligues/rejoindre/<jeton>` | Page « Rejoindre la ligue X ». |
| `/ligues/statistiques` | Statistiques toutes ligues (page actuelle `/stats`), calculées sur les **ligues publiques** seulement. |

Une ligue archivée garde les mêmes onglets en lecture seule. L'actuelle page de détail `/history/<id>` est remplacée par ces onglets.

**Anciennes adresses** (liens partagés, favoris) : redirections permanentes.
- `/classement`, `/calendar`, `/playoffs` mènent à la page équivalente de la **ligue mise en avant** (définie ci-dessous), ou à `/ligues` s'il n'y en a pas.
- `/history` mène à `/ligues`, `/history/<id>` à `/ligues/<id>`, et `/stats` à `/ligues/statistiques`.

**Ligue mise en avant** (accueil, anciennes adresses) : pour un joueur connecté, sa ligue en cours la plus récente ; sinon (ou pour un visiteur), la ligue publique en cours la plus récente. L'accueil garde son encart « saison en cours » (avancement, podium) sur cette ligue, avec un lien vers `/ligues`.

**Navigation** (`lib/nav.ts`) : « Ligue » pointe vers `/ligues` et s'allume sur toute la section `/ligues`. Les onglets d'une ligue sont « Classement · Calendrier · (Playoffs) · Gérer » (« Gérer » seulement pour qui peut gérer). « Statistiques » devient un lien sur la page `/ligues`.

## API

Les routes qui supposaient la ligue active prennent l'identifiant de la ligue.

| Route | Accès |
|---|---|
| `GET /api/leagues` | ligues visibles par l'appelant |
| `POST /api/leagues` | tout joueur ; corps `{ name, visibility }` ; organisateur = appelant |
| `PATCH /api/leagues/[id]` | gérer : `{ name?, visibility? }` |
| `DELETE /api/leagues/[id]` | gérer (organisateur : seulement si aucun score saisi) |
| `POST /api/leagues/[id]/close` | gérer |
| `POST /api/leagues/[id]/invite` | gérer : crée ou renouvelle le jeton, renvoie le lien |
| `POST /api/leagues/join` | joueur ; corps `{ token }` ; inscrit l'appelant |
| `POST /api/leagues/[id]/players` | gérer : inscrire un joueur |
| `PATCH /api/leagues/[id]/players/[playerId]` | gérer, ou le joueur lui-même : deck (le deck doit appartenir au joueur) |
| `DELETE /api/leagues/[id]/players/[playerId]` | gérer, ou le joueur lui-même (avant génération des matchs) |
| `POST / DELETE /api/leagues/[id]/matches` | gérer : générer ou réinitialiser le round-robin (remplace `/api/matches/generate`) |
| `PATCH / DELETE /api/matches/[id]` | gérer la ligue **du match** |
| `GET / POST / DELETE /api/leagues/[id]/playoffs` | lecture : voir ; écriture : gérer (remplace `/api/playoffs`) |
| `PATCH / DELETE /api/playoffs/[id]` | gérer la ligue **du playoff** |

- `POST /api/players` (création d'un joueur par l'admin) **n'inscrit plus** automatiquement le joueur dans la ligue active.
- Les anciennes routes `/api/matches/generate` et `/api/playoffs` sont supprimées : seule l'interface du site les appelle.
- Messages d'erreur en français, comme aujourd'hui.

## Administration (`/admin`)

`/admin` garde les **comptes** (`AccountsPanel`, invitations) et gagne une liste de **toutes les ligues** (y compris privées) avec un lien « Gérer » vers `/ligues/<id>/gerer`. Les panneaux de gestion de ligue quittent `/admin` pour la page `/ligues/<id>/gerer` (mêmes composants, paramétrés par la ligue).

## Erreurs et cas limites

- Ligue introuvable ou privée et non visible : 404 « Ligue introuvable. »
- Lien d'invitation invalide ou renouvelé : « Ce lien d'invitation n'est plus valable. Demande-en un nouveau à l'organisateur. »
- Rejoindre une ligue dont les matchs sont générés : « Les matchs ont déjà été générés : impossible de rejoindre cette ligue. »
- Rejoindre une ligue archivée : même refus.
- Déjà inscrit : la page de rejoindre affiche « Tu es déjà inscrit » avec un lien vers la ligue.
- Organisateur dont le compte est supprimé : `owner_player_id` passe à nul, la ligue reste gérable par les admins.

## Tests

- Vitest : `lib/leagues/access.ts` (tous les cas visiteur, inscrit, organisateur, admin, public, privé) ; requêtes de `lib/db-leagues.ts` (création sans limite, liste filtrée par visibilité, jeton, rejoindre) sur la base simulée ; routes API (droits 401/403/404, règles « matchs déjà générés ») ; `lib/nav.ts` (onglets, « Gérer »).
- Navigateur : nouveau script `scripts/leagues-check.mjs` : un joueur crée une ligue privée, copie le lien, un second joueur la rejoint, un troisième ne la voit pas ; l'organisateur génère les matchs et saisit un score ; anciennes adresses redirigées. `home-nav-check.mjs` mis à jour.

## Hors champ (parties suivantes)

- Rondes suisses (1 bis).
- Saisie des scores par les joueurs, choix physique / en ligne (2).
- Match en ligne BO3 avec score automatique (3).
- Co-organisateurs, transfert d'une ligue, statistiques par ligue.
- Les questions de #51 (deck figé, départage) restent à trancher dans la partie 2.
