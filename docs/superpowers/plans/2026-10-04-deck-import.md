# Import de decks (Scryfall, FR) — Plan d'implémentation

> **Pour l'implémenteur :** exécuter les tâches dans l'ordre, en TDD (test qui échoue → code minimal → test qui passe → commit). Cases à cocher `- [ ]`.

**Objectif :** permettre à chaque joueur de coller la liste de son deck, la compléter via Scryfall (français si possible) avec un cache D1 partagé, et l'afficher sur une page publique « Voir le deck ».

**Architecture :** fonctions pures dans `lib/cards/` (lecture de liste, regroupement), un client Scryfall à dépendances injectées (`fetch`, `sleep`), l'accès D1 dans `lib/db-cards.ts`, et deux services (`resolve.ts` remplit le cache par paquets de 25 lignes, `commit.ts` réécrit le deck à partir du seul cache). L'interface pilote les paquets depuis le navigateur pour rester sous la limite Cloudflare de 50 appels sortants par requête.

**Stack :** Next.js 15 (edge) sur Cloudflare Pages, D1, TypeScript strict, Tailwind, Lucide, Vitest + adaptateur D1 `test/d1.ts`.

**Spec :** `docs/superpowers/specs/2026-10-04-deck-import-design.md`

## Contraintes globales

- Paquet de résolution : **25 lignes** au plus ; liste : **250 lignes de cartes** au plus.
- `/cards/collection` : **75** identifiants au plus par appel ; recherche FR : **10** `oracle_id` au plus par requête.
- En-têtes Scryfall : `User-Agent: dc-league/1.0`, `Accept: application/json` ; au moins **100 ms** entre deux appels.
- Requête FR : `q=(oracleid:A or oracleid:B …) lang:fr`, `unique=prints`, `order=released`, `dir=desc`, `include_extras=true`.
- Clé de cache : `nom en minuscules, espaces normalisés|set en minuscules|numéro` (parties absentes vides).
- Quantité valide : **1 à 99**.
- Erreur Scryfall 429 ou 5xx → `ScryfallUnavailableError` → HTTP **503** « Scryfall ne répond pas, réessaie dans un instant ».
- Navigateur : en cas d'échec d'un paquet, **un** nouvel essai automatique après **2 s**, puis bouton « Reprendre l'import ».
- Préférence FR/EN : `localStorage`, clé `dc-card-lang`, valeur par défaut `fr`, lecture et écriture dans un `try/catch`.
- Toutes les routes : `runtime = 'edge'`, `assertSameOrigin` sur les méthodes qui modifient des données, `requireUser` + `canEditDeck`.
- D1 limite le nombre de paramètres par requête : une instruction `INSERT` **par ligne**, regroupées dans `db.batch`.

## Points de vigilance (Review Focus)

1. **Export Moxfield réel avec CRLF et espaces insécables** (copié depuis Windows ou un navigateur) : les lignes doivent être lues normalement. → test Tâche 2 (`\r\n` et ` `).
2. **Même carte sur deux lignes** (par exemple `1 Forest` dans le commandant par erreur, puis `30 Forest`) : deux lignes distinctes en base, aucune collision de clé primaire. → test Tâche 5 (positions distinctes).
3. **Le même nom avec deux éditions différentes dans la liste** : deux entrées de cache distinctes, chaque ligne garde son impression. → test Tâche 4.
4. **Réimport partiel après une erreur 503** : les paquets déjà résolus ne refont aucun appel. → test Tâche 4 (« second appel sans réseau »).
5. **Carte double face sans `image_uris` au niveau racine** : `image_normal` de la carte reprend la face avant, sinon la vignette serait vide. → test Tâche 3 (`toCardRow` sur la double face).

---

## Carte des fichiers

| Action | Fichier | Responsabilité |
|---|---|---|
| Créer | `migrations/0003_deck_cards.sql` | Tables `cards`, `card_lookups`, `deck_cards` (SQL exact dans la spec) |
| Modifier | `test/d1.ts` | Ajouter `0003_deck_cards.sql` à `MIGRATIONS` |
| Créer | `lib/cards/types.ts` | `ParsedLine`, `CardRow`, `CardFace`, `DeckCardView`, `ImportSummary`, `CardGroup` |
| Créer | `lib/cards/parse.ts` | `parseDeckList`, `lookupKey` |
| Créer | `lib/cards/scryfall.ts` | Client Scryfall, `toCardRow`, `pickFrenchPrint` |
| Créer | `test/fixtures/scryfall/*.json` | Réponses Scryfall enregistrées |
| Créer | `lib/db-cards.ts` | Cache, contenu des decks, commandant |
| Créer | `lib/cards/resolve.ts` | Résolution d'un paquet |
| Créer | `lib/cards/commit.ts` | Enregistrement de la liste |
| Créer | `lib/cards/groups.ts` | Regroupement et tri pour l'affichage |
| Créer | `app/api/decks/[id]/import/resolve/route.ts`, `…/import/commit/route.ts`, `…/commander/route.ts` | Routes |
| Créer | `components/decks/ImportPanel.tsx` | Panneau d'import (aperçu, paquets, reprise, résumé) |
| Modifier | `app/profil/decks/page.tsx`, `app/profil/decks/MyDecks.tsx` | Nombre de cartes, bouton d'import, lien vers le deck |
| Créer | `app/decks/[id]/page.tsx`, `app/decks/[id]/DeckView.tsx` | Page « Voir le deck » |
| Modifier | `lib/db-leagues.ts`, `app/page.tsx`, `components/LeaderboardTable.tsx`, `app/history/[id]/page.tsx` | Liens vers `/decks/[id]` |

---

### Tâche 1 : Migration, types et cache de cartes en base

**Fichiers :** Créer `migrations/0003_deck_cards.sql`, `lib/cards/types.ts`, `lib/db-cards.ts`, `lib/db-cards.cache.test.ts` ; Modifier `test/d1.ts`

**Interfaces — Produit :**
- `types.ts` :
  ```ts
  export type Section = 'commander' | 'main'
  export type ParsedLine = { lineNumber: number; quantity: number; name: string; set: string | null; number: string | null; section: Section }
  export type CardFace = { name: string; printed_name: string | null; mana_cost: string | null; type_line: string; printed_type_line: string | null; oracle_text: string | null; printed_text: string | null; image_normal: string | null; image_small: string | null }
  export type CardRow = { id: string; oracle_id: string; lang: string; name: string; printed_name: string | null; set_code: string; collector_number: string; released_at: string | null; mana_cost: string | null; cmc: number; type_line: string; printed_type_line: string | null; oracle_text: string | null; printed_text: string | null; colors: string[]; color_identity: string[]; image_normal: string | null; image_small: string | null; faces: CardFace[] | null }
  export type CardLookup = { key: string; en_card_id: string | null; fr_card_id: string | null }
  ```
- `db-cards.ts` (format `Result<T>` du projet) :
  - `upsertCards(db, cards: CardRow[], now: Date)` → `true` (`INSERT … ON CONFLICT(id) DO UPDATE`, JSON pour `colors`, `color_identity`, `faces`)
  - `getCards(db, ids: string[])` → `Record<string, CardRow>` (JSON relu)
  - `getLookups(db, keys: string[])` → `Record<string, CardLookup>`
  - `saveLookups(db, lookups: CardLookup[], now: Date)` → `true` (`INSERT OR REPLACE`)

- [ ] **Étape 1 :** écrire la migration (SQL de la spec) et l'ajouter à `MIGRATIONS` dans `test/d1.ts`.
- [ ] **Étape 2 : tests qui échouent** (`lib/db-cards.cache.test.ts`)
  - `upsertCards puis getCards relit une carte identique` : `colors`, `faces` (tableau d'objets) et `cmc` reviennent typés comme à l'écriture.
  - `upsertCards met à jour une carte existante` (même `id`, nouveau `printed_name`).
  - `saveLookups mémorise l'absence de version française` : `fr_card_id: null` relu comme `null`, et la clé est bien présente dans le résultat.
  - `getLookups ignore les clés inconnues` et `getCards([])` renvoie `{}` sans requête SQL invalide.
- [ ] **Étape 3 : lancer** `npx vitest run lib/db-cards.cache.test.ts` → FAIL. **Étape 4 : implémenter.** **Étape 5 : lancer** → PASS.
- [ ] **Étape 6 : commit** `feat(cards): migration et cache de cartes`

---

### Tâche 2 : Lecture de la liste

**Fichiers :** Créer `lib/cards/parse.ts`, `lib/cards/parse.test.ts`, `test/fixtures/moxfield-export.txt`

**Interfaces — Produit :**
- `MAX_CARD_LINES = 250`
- `parseDeckList(text: string): { lines: ParsedLine[]; ignored: number; errors: { lineNumber: number; text: string }[]; tooLong: boolean }`
- `lookupKey(line: { name: string; set: string | null; number: string | null }): string`

- [ ] **Étape 1 : tests qui échouent**

```ts
it.each([
  ['1 Sol Ring', { quantity: 1, name: 'Sol Ring', set: null, number: null }],
  ['1x Sol Ring', { quantity: 1, name: 'Sol Ring', set: null, number: null }],
  ['Sol Ring', { quantity: 1, name: 'Sol Ring', set: null, number: null }],
  ['30 Forest', { quantity: 30, name: 'Forest', set: null, number: null }],
  ['1 Sol Ring (C21) 263', { quantity: 1, name: 'Sol Ring', set: 'C21', number: '263' }],
  ['1 Sol Ring (C21) 263 *F*', { quantity: 1, name: 'Sol Ring', set: 'C21', number: '263' }],
  ['1 Kenrith, the Returned King (ELD) 303 *CMDR*', { quantity: 1, name: 'Kenrith, the Returned King', set: 'ELD', number: '303' }],
  ['1 Delver of Secrets // Insectile Aberration (ISD) 51', { quantity: 1, name: 'Delver of Secrets // Insectile Aberration', set: 'ISD', number: '51' }],
  ['1 Forest (SLD) 2024-1', { quantity: 1, name: 'Forest', set: 'SLD', number: '2024-1' }],
  ['1 Island (PLST) 123a', { quantity: 1, name: 'Island', set: 'PLST', number: '123a' }],
])('lit « %s »', (text, expected) => {
  expect(parseDeckList(text).lines[0]).toMatchObject({ ...expected, section: 'main', lineNumber: 1 })
})
```
  - `en-têtes` : `'Commander\n1 Kenrith\n\nDeck\n1 Sol Ring'` → Kenrith en `commander`, Sol Ring en `main` ; même résultat avec `COMMANDER:` et `// Commander`.
  - `sections ignorées` : `'1 Sol Ring\nSideboard\n1 Duress\n2 Negate\nMaybeboard\n1 X\nDeck\n1 Arcane Signet'` → 2 lignes, `ignored === 4`.
  - `CRLF, espaces insécables et commentaires` (point de vigilance 1) : `'# mon deck\r\n1 Sol Ring\r\n\r\n1 Arcane Signet'` → 2 lignes, noms exacts, 0 erreur.
  - `erreurs` : `'0 Sol Ring'`, `'100 Forest'`, `'3'` → chacune dans `errors` avec son `lineNumber`.
  - `limite` : 251 lignes `1 Forest` → `tooLong === true`.
  - `export Moxfield complet` : le fichier `test/fixtures/moxfield-export.txt` (un deck de 100 cartes au format Arena, avec section Commander) → 1 commandant, somme des quantités = 100, 0 erreur.
  - `lookupKey` : `{ name: '  Sol   Ring ', set: 'C21', number: '263' }` → `'sol ring|c21|263'` ; sans édition → `'sol ring||'`.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** Normaliser `\r\n` et ` ` avant découpage. Expression des lignes de carte : quantité optionnelle (`^(\d+)x?\s+`), nom, puis optionnellement `\(([A-Za-z0-9]+)\)\s+(\S+)`, puis des marques `*X*` ignorées.
- [ ] **Étape 4 : lancer** → PASS. **Étape 5 : commit** `feat(cards): lecture des listes de deck`

---

### Tâche 3 : Client Scryfall

**Fichiers :** Créer `lib/cards/scryfall.ts`, `lib/cards/scryfall.test.ts`, `test/fixtures/scryfall/` : `collection.json` (Sol Ring C21 263 et Kenrith ELD 303 en anglais, plus un `not_found`), `collection-dfc.json` (Delver of Secrets, `layout: transform`, `card_faces` avec `image_uris` et sans `image_uris` à la racine), `search-fr-page1.json` (`has_more: true`, `next_page`), `search-fr-page2.json`.

Les réponses enregistrées sont rédigées à la main **au format documenté de l'API publique** (objets `card`, `list`, `error`) et limitées aux champs que `toCardRow` lit.

**Interfaces — Produit :**
- `type ScryfallDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void> }`
- `class ScryfallUnavailableError extends Error`
- `type Identifier = { set: string; collector_number: string } | { name: string }`
- `createScryfallClient(deps: ScryfallDeps)` → `{ fetchCollection(ids: Identifier[]): Promise<{ cards: ScryfallCard[]; notFound: Identifier[] }>; searchFrenchPrints(oracleIds: string[]): Promise<ScryfallCard[]> }` (le client garde l'heure du dernier appel et attend le reste des 100 ms avec `sleep`)
- `toCardRow(card: ScryfallCard): CardRow`
- `pickFrenchPrint(prints: CardRow[], wanted: { set: string | null; number: string | null }): CardRow | null`

- [ ] **Étape 1 : tests qui échouent** (un `fetch` factice qui enregistre les requêtes et renvoie les fichiers enregistrés ; `sleep` factice qui enregistre les durées)
  - `fetchCollection envoie POST /cards/collection` avec le corps `{ identifiers: [...] }`, les en-têtes `User-Agent` et `Accept`, et renvoie les cartes ainsi que `notFound`.
  - `fetchCollection découpe au-delà de 75 identifiants` (80 identifiants → 2 appels).
  - `searchFrenchPrints groupe par 10 et suit la pagination` : 12 `oracle_id` → 2 recherches ; la première a une page 2, donc 3 appels au total. L'URL contient `lang%3Afr`, `unique=prints`, `order=released`, `dir=desc`, `include_extras=true` et `oracleid%3A`.
  - `searchFrenchPrints renvoie [] sur un 404`.
  - `429 → ScryfallUnavailableError` ; `503 → ScryfallUnavailableError`.
  - `attend 100 ms entre deux appels` : deux appels consécutifs → `sleep` appelé avec une valeur > 0 et ≤ 100.
  - `toCardRow sur une carte simple` : `image_normal` depuis `image_uris.normal`, `faces === null`, `colors` repris.
  - `toCardRow sur une double face` (point de vigilance 5) : `faces.length === 2`, `image_normal` égal à `faces[0].image_normal`, `type_line` de la racine conservé.
  - `toCardRow lit printed_name, printed_type_line et printed_text` pour une carte `lang: 'fr'`.
  - `pickFrenchPrint` : même édition et même numéro > même édition > premier ; liste vide → `null`.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter** (URL de base `https://api.scryfall.com`). **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(cards): client Scryfall`

---

### Tâche 4 : Résolution d'un paquet

**Fichiers :** Créer `lib/cards/resolve.ts`, `lib/cards/resolve.test.ts`

**Interfaces :**
- Consomme : T1 (`getLookups`, `saveLookups`, `upsertCards`), T2 (`lookupKey`), T3 (client, `toCardRow`, `pickFrenchPrint`).
- Produit : `MAX_BATCH_LINES = 25` ; `resolveLines(db: D1Database, client: ScryfallClient, lines: ParsedLine[], now: Date): Promise<{ resolved: number; notFound: string[] }>`. `notFound` contient les noms demandés ; `resolved` compte les lignes du paquet qui ont un `en_card_id`, y compris celles déjà en cache.

- [ ] **Étape 1 : tests qui échouent** (base `createTestDb()` ; faux client Scryfall en mémoire qui compte ses appels)
  - `résout une carte avec édition, en français de la même édition` : `card_lookups['sol ring|c21|263']` contient `en_card_id` et `fr_card_id` de C21, et les deux cartes sont dans `cards`.
  - `sans version française, fr_card_id est null`.
  - `édition introuvable → nouvelle recherche par nom` : 2 appels `fetchCollection`, `en_card_id` renseigné.
  - `carte introuvable` : la clé est enregistrée avec `en_card_id: null`, et le nom figure dans `notFound`.
  - `même nom avec deux éditions` (point de vigilance 3) : deux clés, deux `en_card_id` différents.
  - `second appel identique sans réseau` (point de vigilance 4) : le faux client compte 0 nouvel appel, et `resolved` reste égal au premier.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter** selon l'algorithme de la spec (section « Résolution d'un paquet »). Les doublons de clé dans un paquet ne sont résolus qu'une fois.
- [ ] **Étape 4 : lancer** → PASS. **Étape 5 : commit** `feat(cards): résolution des cartes par paquet`

---

### Tâche 5 : Contenu des decks et enregistrement

**Fichiers :** Modifier `lib/db-cards.ts` ; Créer `lib/cards/commit.ts`, `lib/db-cards.decks.test.ts`, `lib/cards/commit.test.ts`

**Interfaces — Produit :**
- `types.ts` : `DeckCardView = { position: number; quantity: number; section: Section; requested_name: string; en: CardRow | null; fr: CardRow | null }` ; `ImportSummary` (champs exacts de la spec).
- `db-cards.ts` :
  - `replaceDeckCards(db, deckId, rows: { position, quantity, section, requested_name, requested_set, requested_number, en_card_id, fr_card_id }[])` → `true` (`DELETE` puis `INSERT` dans un seul `batch`)
  - `listDeckCards(db, deckId)` → `DeckCardView[]` (triées par `position`)
  - `countDeckCards(db, deckIds: string[])` → `Record<string, number>` (somme des quantités)
  - `setCommander(db, deckId, position)` → `CardRow` (la carte, pour l'image), erreurs `'NOT_FOUND'` et `'NOT_LEGENDARY'`
  - `setDeckCommanderImage(db, deckId, url: string | null)` → `true`
- `commit.ts` : `commitDeckList(db, deckId, text, now): Promise<Result<ImportSummary>>`, erreurs `'EMPTY'` et `'TOO_LONG'`.

- [ ] **Étape 1 : tests qui échouent**
  - `replaceDeckCards remplace tout le contenu` (deux imports successifs → seul le second reste).
  - `même carte sur deux lignes` (point de vigilance 2) → deux lignes distinctes, sans erreur de clé primaire.
  - `listDeckCards joint les versions EN et FR` ; carte introuvable → `en: null`.
  - `countDeckCards` additionne les quantités ; un deck sans cartes est absent du résultat.
  - `setCommander` déplace la carte en `commander` ; `NOT_LEGENDARY` pour `Sol Ring` ; `NOT_FOUND` pour une position inconnue.
  - `commitDeckList` (cache rempli à la main via `upsertCards` et `saveLookups`) : résumé `{ total: 100, commanders: 1, frenchCount: …, notFound: [], ignored: 2 }` ; une ligne absente du cache figure dans `notFound` avec son `lineNumber` et son texte ; l'image du commandant devient l'`image_normal` FR ; texte vide → `EMPTY` ; 251 lignes → `TOO_LONG`.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(cards): contenu des decks et enregistrement de la liste`

---

### Tâche 6 : Regroupement pour l'affichage

**Fichiers :** Créer `lib/cards/groups.ts`, `lib/cards/groups.test.ts`

**Interfaces — Produit :**
- `type CardGroup = 'commander' | 'creature' | 'planeswalker' | 'battle' | 'sorcery' | 'instant' | 'artifact' | 'enchantment' | 'land' | 'other' | 'notFound'`
- `GROUP_LABELS: Record<CardGroup, string>` : Commandant, Créatures, Planeswalkers, Batailles, Rituels, Éphémères, Artefacts, Enchantements, Terrains, Autres, Introuvables.
- `displayCard(card: DeckCardView, lang: 'fr' | 'en'): CardRow | null` (FR si demandé et disponible, sinon EN)
- `groupDeckCards(cards: DeckCardView[], lang: 'fr' | 'en'): { group: CardGroup; label: string; count: number; cards: DeckCardView[] }[]`

- [ ] **Étape 1 : tests qui échouent**
  - `Dryad Arbor` (`Land Creature — Forest Dryad`) → `land` ; `Solemn Simulacrum` (`Artifact Creature`) → `creature` ; `Lovestruck Beast // Heart's Desire` (adventure, type racine `Creature — Beast Noble // Sorcery — Adventure`) → `creature` (face avant).
  - section `commander` → `commander` quel que soit le type ; `en: null` → `notFound`.
  - ordre des groupes conforme, groupes vides omis, `count` = somme des quantités.
  - tri par `cmc` puis par nom affiché ; avec `lang: 'fr'` le tri utilise `printed_name`.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter.** **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 : commit** `feat(cards): regroupement par type`

---

### Tâche 7 : Routes d'API

**Fichiers :** Créer `app/api/decks/[id]/import/resolve/route.ts`, `app/api/decks/[id]/import/commit/route.ts`, `app/api/decks/[id]/commander/route.ts`, et `lib/cards/deck-access.ts` (contrôle commun : origine, `requireUser`, `getDeck`, `canEditDeck` → `{ db, deck, user } | NextResponse`, avec les mêmes messages que `app/api/decks/[id]/route.ts`, qu'on fait utiliser ce module commun)

- [ ] **Étape 1 :** `resolve` : valide `lines` (tableau de 1 à 25 éléments, chaque élément conforme à `ParsedLine`, sinon 400 « Paquet invalide ») → `resolveLines(db, createScryfallClient({ fetch, sleep: (ms) => new Promise(r => setTimeout(r, ms)) }), lines, new Date())` ; `ScryfallUnavailableError` → 503 avec le message de la spec.
- [ ] **Étape 2 :** `commit` : `{ text }` → `commitDeckList` ; `EMPTY` → 400 « La liste est vide » ; `TOO_LONG` → 400 « La liste dépasse 250 lignes ».
- [ ] **Étape 3 :** `commander` : `{ position }` (entier) → `setCommander` puis `setDeckCommanderImage` (FR si disponible) ; `NOT_FOUND` → 404 « Carte introuvable dans ce deck » ; `NOT_LEGENDARY` → 400 « Seule une carte légendaire peut être commandant ».
- [ ] **Étape 4 : vérifier** `npm test` et `npx tsc --noEmit` → OK.
- [ ] **Étape 5 : commit** `feat(cards): routes d'import et de commandant`

---

### Tâche 8 : Panneau d'import dans « Mes decks »

**Fichiers :** Créer `components/decks/ImportPanel.tsx` ; Modifier `app/profil/decks/page.tsx`, `app/profil/decks/MyDecks.tsx`

- [ ] **Étape 1 :** `page.tsx` charge `countDeckCards(db, ids)` et le passe à `MyDecks` (`cardCounts: Record<string, number>`).
- [ ] **Étape 2 :** `MyDecks` : sous le nom, « N cartes » si N > 0 ; nom cliquable vers `/decks/<id>` si N > 0 ; bouton « Importer la liste » (icône `Upload`) qui ouvre `ImportPanel` sous le deck.
- [ ] **Étape 3 :** `ImportPanel({ deckId, onDone })` : zone de texte (12 lignes) ; aperçu en direct via `parseDeckList` (« X cartes · Y commandant(s) · Z lignes ignorées · W illisibles », avec la liste des lignes illisibles) ; bouton « Importer » désactivé si 0 carte ou `tooLong`. Déroulé :
  1. découper `lines` en paquets de `MAX_BATCH_LINES` et les envoyer un par un à `resolve`, avec une barre de progression ;
  2. en cas d'échec, attendre 2 s et réessayer une fois ; en cas de nouvel échec, afficher l'erreur et « Reprendre l'import », qui repart du paquet en échec ;
  3. appeler `commit` avec le texte ;
  4. afficher le résumé : « 100 cartes · 87 % en français », la liste des introuvables (ligne et texte), puis le bouton « Voir le deck ». Appeler `onDone(total)` pour mettre à jour le compteur.
- [ ] **Étape 4 : vérifier** `npx tsc --noEmit` → OK.
- [ ] **Étape 5 : commit** `feat(cards): panneau d'import dans Mes decks`

---

### Tâche 9 : Page « Voir le deck »

**Fichiers :** Créer `app/decks/[id]/page.tsx`, `app/decks/[id]/DeckView.tsx` ; Modifier `middleware.ts` uniquement si besoin (la page est **publique**, elle ne doit pas être ajoutée au `matcher`)

- [ ] **Étape 1 : page serveur** : `getDeck` (`notFound()` si absent) ; nom du joueur ; `listDeckCards` ; `getCurrentUser()` pour `canEdit = !!user && canEditDeck(user, deck)` ; passer le tout à `DeckView`.
- [ ] **Étape 2 : `DeckView` (client)** :
  - **langue** : état initial `fr`, lu dans `localStorage['dc-card-lang']` au montage ; un bouton bascule FR/EN et écrit la nouvelle valeur ;
  - **en-tête** : image, nom, joueur, total, lien Moxfield ;
  - **groupes** : `groupDeckCards(cards, lang)`, sur 2 colonnes à partir de `md`, avec pour chaque ligne la quantité, le nom affiché et `mana_cost` en texte ;
  - **survol** (souris) : aperçu flottant `image_normal` à côté du curseur ;
  - **clic ou toucher** : fenêtre plein écran avec l'image et, si `faces`, les images de chaque face côte à côte ; fermeture au clic sur le fond ou à la touche Échap ;
  - **si `canEdit`** : lien « Réimporter » vers `/profil/decks`, et « Définir comme commandant » dans la fenêtre pour une carte dont la `type_line` contient `Legendary`, qui appelle `PATCH /api/decks/<id>/commander` puis `router.refresh()` ;
  - bouton « Tester le deck » désactivé, avec la mention « Bientôt » ;
  - deck sans cartes : « Ce deck n'a pas encore de liste importée. »
- [ ] **Étape 3 : vérifier** `npx tsc --noEmit` → OK.
- [ ] **Étape 4 : commit** `feat(cards): page Voir le deck`

---

### Tâche 10 : Liens depuis le classement et l'historique

**Fichiers :** Modifier `lib/db-leagues.ts`, `app/page.tsx`, `components/LeaderboardTable.tsx`, `app/history/[id]/page.tsx` ; Test : `lib/db-leagues.test.ts`

- [ ] **Étape 1 : test qui échoue** : `listLeaguePlayers` renvoie `deck_has_cards: true` pour un deck avec au moins une ligne `deck_cards`, `false` sinon.
- [ ] **Étape 2 : lancer** → FAIL. **Étape 3 : implémenter** : `EXISTS(SELECT 1 FROM deck_cards dc WHERE dc.deck_id = lp.deck_id) AS deck_has_cards` dans la requête, et le champ dans `DbLeaguePlayerWithName` et sa fonction de normalisation. **Étape 4 : lancer** → PASS.
- [ ] **Étape 5 :** `app/page.tsx` et `app/history/[id]/page.tsx` passent `deck_url: lp.deck_has_cards ? '/decks/' + lp.deck_id : null` ; `LeaderboardTable` (et l'affichage de l'historique) rend le nom du deck dans un `Link` quand `deck_url` est présent.
- [ ] **Étape 6 : vérifier** `npm test` et `npx tsc --noEmit` → OK. **Étape 7 : commit** `feat(cards): liens vers les decks importés`

---

### Tâche 11 : Vérification finale

- [ ] **Étape 1 :** `npm test` → tout passe (noter le nombre) ; `npx tsc --noEmit` → aucune erreur.
- [ ] **Étape 2 :** `npx @cloudflare/next-on-pages` → build réussi.
- [ ] **Étape 3 : parcours local** : `npm run db:migrate:local`, `wrangler pages dev`, puis avec `curl` : un deck d'un autre joueur → 403 sur `resolve`, `commit` et `commander` ; `commit` d'une liste dont aucune carte n'est en cache → toutes les cartes introuvables, sans erreur ; cartes insérées à la main dans le cache local puis `commit` → la page `/decks/<id>` affiche les groupes ; `commander` sur une carte non légendaire → 400. L'appel réel à Scryfall depuis `resolve` n'est **pas** vérifiable ici (domaine bloqué) : le dire.
- [ ] **Étape 4 :** fournir à l'utilisateur la liste des vérifications à faire après déploiement : import d'un vrai export Moxfield, pourcentage en français plausible, carte double face (verso visible), bascule FR/EN, réimport rapide, et une carte volontairement mal orthographiée qui doit apparaître dans « Introuvables ».
- [ ] **Étape 5 :** README : section « Import de decks » (format accepté, migration `0003`).
- [ ] **Étape 6 : commit et push** `docs: import de decks dans le README`
