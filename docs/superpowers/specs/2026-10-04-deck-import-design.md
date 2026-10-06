# Design — Import de decks (Scryfall, cartes en français)

**Date :** 2026-10-04  
**Statut :** En relecture  
**Sous-projet :** 2/3 de la feuille de route « jeu en ligne » (1. comptes joueurs ✅ → 2. import de decks → 3. mode test solo → plus tard multijoueur)

---

## Contexte

Les decks (`decks`) n'ont aujourd'hui qu'un nom, un lien Moxfield et une URL d'image de commandant saisie à la main. Pour le mode test, le jeu en ligne et l'analyse IA, il faut connaître **chaque carte** d'un deck, avec ses données de jeu et ses images, en **français** quand c'est possible.

Depuis le sous-projet 1, chaque joueur a un compte et gère ses decks dans `/profil/decks`.

## Objectifs

- Un joueur colle la liste de son deck (export texte Moxfield, Arena ou MTGO) et l'appli complète chaque carte avec Scryfall.
- Chaque carte est stockée en anglais, et en français si une impression française existe.
- Un cache partagé en base rend les imports suivants quasi instantanés.
- Une page publique « Voir le deck » affiche la liste par type, avec images et bouton FR/EN.

## Hors périmètre

- Vérification de légalité (banlist, 100 cartes, singleton, identité de couleur).
- Import par lien Moxfield (API non officielle).
- Réserve et maybeboard (lignes ignorées et comptées).
- Historique des versions d'un deck : réimporter remplace le contenu.
- Prix, statistiques, combos (sous-projet ultérieur).

---

## Décisions

| Sujet | Décision |
|---|---|
| Légalité | Aucune vérification à l'import |
| Impression | Respecter l'édition demandée, en français si elle existe dans cette édition ; sinon impression française la plus récente ; sinon l'anglais de l'édition demandée. Sans édition : française la plus récente, sinon anglaise par défaut de Scryfall |
| Après import | Résumé + page « Voir le deck » |
| Appels Scryfall | Faits par le serveur, par paquets de 20 lignes pilotés par le navigateur (limite Cloudflare de 50 appels sortants par requête ; 20 cartes distinctes = une seule recherche Scryfall, dont la requête est tronquée à 1000 caractères) |
| Confiance | L'enregistrement relit le texte brut et n'utilise que le cache serveur, jamais des données de cartes envoyées par le navigateur |

---

## Modèle de données

Migration `migrations/0003_deck_cards.sql`.

```sql
CREATE TABLE IF NOT EXISTS cards (
  id                TEXT PRIMARY KEY,   -- id Scryfall de l'impression dans cette langue
  oracle_id         TEXT NOT NULL,
  lang              TEXT NOT NULL,
  name              TEXT NOT NULL,      -- nom anglais
  printed_name      TEXT,               -- nom imprimé (FR), NULL si identique au nom anglais
  set_code          TEXT NOT NULL,
  collector_number  TEXT NOT NULL,
  released_at       TEXT,
  mana_cost         TEXT,
  cmc               REAL NOT NULL DEFAULT 0,
  type_line         TEXT NOT NULL,
  printed_type_line TEXT,
  oracle_text       TEXT,
  printed_text      TEXT,
  colors            TEXT NOT NULL DEFAULT '[]',   -- JSON
  color_identity    TEXT NOT NULL DEFAULT '[]',   -- JSON
  image_normal      TEXT,
  image_small       TEXT,
  faces             TEXT,               -- JSON : CardFace[] pour les cartes à plusieurs faces, sinon NULL
  fetched_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cards_oracle ON cards(oracle_id, lang);

CREATE TABLE IF NOT EXISTS card_lookups (
  key        TEXT PRIMARY KEY,          -- "nom normalisé|set|numéro"
  en_card_id TEXT REFERENCES cards(id), -- NULL = introuvable
  fr_card_id TEXT REFERENCES cards(id), -- NULL = aucune impression française
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deck_cards (
  deck_id          TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  position         INTEGER NOT NULL,
  quantity         INTEGER NOT NULL,
  section          TEXT NOT NULL CHECK (section IN ('commander', 'main')),
  requested_name   TEXT NOT NULL,
  requested_set    TEXT,
  requested_number TEXT,
  en_card_id       TEXT REFERENCES cards(id),
  fr_card_id       TEXT REFERENCES cards(id),
  PRIMARY KEY (deck_id, position)
);
```

`CardFace` (JSON) : `{ name, printed_name, mana_cost, type_line, printed_type_line, oracle_text, printed_text, image_normal, image_small }`. Pour les cartes double face (`transform`, `modal_dfc`…), les images sont sur les faces ; `image_normal` / `image_small` de la carte reprennent alors la face avant.

**Clé de recherche** (`card_lookups.key`) : `nom|set|numéro`. Le nom est mis en minuscules, avec les espaces normalisés ; le set en minuscules ; les parties absentes sont vides. Exemples : `sol ring|c21|263`, `sol ring||`.

Principes :
- Le cache n'expire pas : les données de jeu et les images d'une impression ne changent pas.
- Réimporter **remplace** tout le contenu du deck.
- Le bouton FR/EN ne fait aucun appel réseau : les deux versions sont en base.

---

## Lecture de la liste — `lib/cards/parse.ts` (pur, partagé navigateur/serveur)

```ts
type ParsedLine = { lineNumber: number; quantity: number; name: string; set: string | null; number: string | null; section: 'commander' | 'main' }
type ParseResult = { lines: ParsedLine[]; ignored: number; errors: { lineNumber: number; text: string }[] }
parseDeckList(text: string): ParseResult
lookupKey(line: { name: string; set: string | null; number: string | null }): string
```

- Lignes de carte : `N Nom`, `Nx Nom`, `Nom` (quantité 1), suivies éventuellement de `(SET) numéro`. Les marques finales `*F*`, `*E*`, `*CMDR*` sont ignorées. Le numéro peut contenir lettres et tirets (`123a`, `★`, `2024-1`).
- En-têtes de section, sans distinction de casse, avec ou sans `:` final ou `//` initial : `Commander` → `commander` ; `Deck`, `Main`, `Mainboard` → `main` ; `Sideboard`, `Maybeboard`, `Considering`, `Tokens` → lignes suivantes **ignorées** (comptées dans `ignored`) jusqu'au prochain en-tête.
- Section par défaut : `main`.
- Lignes vides et commentaires (`#…`) ignorés sans être comptés.
- Ligne non reconnue (quantité ≤ 0 ou > 99, nom vide) → `errors`.
- Plus de 250 lignes de cartes → erreur globale « La liste dépasse 250 lignes ».
- Les noms à double face (`A // B`) sont conservés tels quels.

---

## Client Scryfall — `lib/cards/scryfall.ts`

`fetch` est **injecté** (paramètre) pour les tests. Chaque appel envoie `User-Agent: dc-league/1.0` et `Accept: application/json`, avec un intervalle d'au moins 500 ms entre deux appels (y compris avant le premier appel d'une requête d'import, l'appel précédent pouvant venir du paquet précédent) et un délai d'attente de 10 s. Un 429 fait attendre `Retry-After` (30 s par défaut) puis réessayer une fois ; un second échec donne `ScryfallUnavailableError`.

- `fetchCollection(fetch, identifiers)` : `POST https://api.scryfall.com/cards/collection` avec au plus 75 identifiants (`{ set, collector_number }` ou `{ name }`). Renvoie `{ cards: ScryfallCard[]; notFound: Identifier[] }`.
- `searchFrenchPrints(fetch, oracleIds)` : `GET /cards/search?q=(oracleid:A or oracleid:B …) lang:fr&unique=prints&order=released&dir=desc&include_extras=true`, avec au plus 20 identifiants par requête et **une seule page** (175 impressions). Si la page est pleine (`has_more`), les cartes absentes de la page sont recherchées à nouveau sans celles qui l'ont remplie (terrains de base : plus de 400 impressions françaises) ; les pages suivantes ne sont jamais lues. Une réponse 404 (aucun résultat) donne une liste vide.
- `toCardRow(card: ScryfallCard): CardRow` : conversion vers le format de la table `cards`.
- `pickFrenchPrint(prints, wanted: { set, number })` : même édition et même numéro, sinon même édition, sinon le premier, c'est-à-dire le plus récent.
- Erreurs : 429 ou 5xx → `ScryfallUnavailableError`.

## Résolution d'un paquet — `lib/cards/resolve.ts`

`resolveLines(db, fetch, lines: ParsedLine[], now): Promise<{ resolved: number; notFound: string[] }>` (au plus 20 lignes) :

1. Calculer les clés et retirer celles déjà présentes dans `card_lookups`, sauf les entrées négatives (`en_card_id` ou `fr_card_id` NULL) de plus de 7 jours, qui sont recherchées à nouveau. Une ligne « A // B » sans édition est cherchée par sa face avant ; les noms sont comparés sans accents.
2. Un appel `fetchCollection` pour les clés manquantes (édition et numéro si fournis, sinon nom). Pour celles qui ne sont pas trouvées avec une édition, un second appel `fetchCollection` par nom.
3. Pour les cartes trouvées : `searchFrenchPrints` sur leurs `oracle_id`, puis `pickFrenchPrint` pour chaque ligne.
4. Enregistrer `cards` (anglaises et françaises) et `card_lookups` (avec `fr_card_id` NULL si aucune impression française, et `en_card_id` NULL si la carte est introuvable).

Au plus environ 2 + 3 appels Scryfall par paquet de 25.

## Enregistrement — `lib/cards/commit.ts`

`commitDeckList(db, deckId, text, now): Promise<ImportSummary>` :
- `parseDeckList(text)`, puis, pour chaque ligne, lecture de `card_lookups`. Une ligne absente du cache compte comme introuvable.
- Remplacement atomique (`batch`) : `DELETE FROM deck_cards WHERE deck_id`, puis les `INSERT`.
- Si une carte est en section `commander` et trouvée, `decks.commander_image_url` prend son `image_normal`, en français si elle existe.
- `ImportSummary = { total: number; commanders: number; frenchCount: number; notFound: { lineNumber: number; text: string }[]; ignored: number; errors: { lineNumber: number; text: string }[] }`. `total` et `frenchCount` sont comptés en exemplaires, quantités incluses.

## Regroupement pour l'affichage — `lib/cards/groups.ts` (pur)

`groupDeckCards(cards: DeckCardView[]): { group: CardGroup; cards: DeckCardView[] }[]`

Ordre des groupes : Commandant, Créatures, Planeswalkers, Batailles, Rituels, Éphémères, Artefacts, Enchantements, Terrains, Autres, Introuvables. Le groupe est déterminé par la section, puis par la `type_line` anglaise de la face avant, dans cet ordre de priorité : Land → Terrains, Creature → Créatures, Planeswalker, Battle, Instant, Sorcery, Artifact, Enchantment. Un terrain-créature va donc dans Terrains, et une créature-artefact dans Créatures. Les groupes vides sont omis. Dans chaque groupe, les cartes sont triées par `cmc` puis par nom affiché.

---

## Routes d'API

Toutes en `runtime = 'edge'`, avec `assertSameOrigin`, `requireUser` et `canEditDeck` (sous-projet 1).

| Route | Corps | Réponse |
|---|---|---|
| `POST /api/decks/[id]/import/resolve` | `{ lines: ParsedLine[] }`, 25 au plus (400 sinon) | `{ resolved, notFound }` ; 503 « Scryfall ne répond pas, réessaie dans un instant » si `ScryfallUnavailableError` |
| `POST /api/decks/[id]/import/commit` | `{ text }`, non vide, au plus 250 lignes de cartes | `ImportSummary` |
| `PATCH /api/decks/[id]/commander` | `{ position }` | la carte passe en section `commander` (les autres restent comme elles sont) et l'image du deck est mise à jour ; 404 si la position est inconnue ; 400 si la carte n'est pas légendaire |

## Pages

### `/profil/decks` (existante)

- Chaque deck affiche son nombre de cartes s'il en a, et un bouton **« Importer la liste »**.
- Panneau d'import : zone de texte, puis aperçu de lecture (« 99 cartes · 1 commandant · 2 lignes ignorées · 1 ligne illisible »), puis bouton « Importer ». Une barre de progression avance par paquet de 20. En cas d'échec d'un paquet, un nouvel essai automatique est fait après 2 s, puis le bouton « Reprendre l'import » apparaît. Enfin, le résumé s'affiche (cartes, % en français, introuvables avec leur ligne) avec un bouton « Voir le deck ».
- Le nom d'un deck importé est un lien vers `/decks/[id]`.

### `/decks/[id]` (nouvelle, publique en lecture)

- En-tête : image du commandant, nom du deck, nom du joueur, nombre de cartes, lien Moxfield s'il existe.
- Groupes de `groupDeckCards`, avec le nombre d'exemplaires par groupe. Chaque ligne affiche la quantité, le nom dans la langue choisie et le coût de mana sous forme de texte (`{2}{G}`).
- Image au survol sur ordinateur ; au toucher, fenêtre avec l'image en grand, plus le verso pour les cartes double face.
- Bouton **FR/EN**, mémorisé dans `localStorage` (avec `try/catch`). Le français est utilisé par défaut ; une carte sans version française s'affiche en anglais.
- Pour le propriétaire ou un admin : « Réimporter » (vers `/profil/decks`) et « Définir comme commandant » sur les cartes dont la `type_line` contient `Legendary`.
- Bouton « Tester le deck » désactivé avec la mention « Bientôt ».
- Deck inconnu → 404 ; deck sans cartes → message « Ce deck n'a pas encore de liste importée ».

### Liens

Sur le classement (`/`) et l'historique d'une ligue (`/history/[id]`), le nom du deck devient un lien vers `/decks/[id]` quand le deck a des cartes importées.

Images : URLs Scryfall utilisées directement (`cards.scryfall.io`), sans copie.

---

## Gestion des erreurs

- Scryfall 429 ou 5xx → 503 ; le cache déjà rempli est conservé, et on peut reprendre.
- Carte introuvable → non bloquante, groupe « Introuvables ».
- Pas de version française → anglais, sans avertissement (seul le pourcentage l'indique).
- Liste vide, trop longue ou paquet de plus de 20 lignes → 400 avec un message en français.
- Ligne absente du cache au moment de l'enregistrement → introuvable.

## Tests

- `parse.ts` : chaque format de ligne, les en-têtes, les sections ignorées, les cartes doubles, les numéros spéciaux, les erreurs, la limite de 250 lignes, et un export Moxfield complet (fichier de test).
- `scryfall.ts`, avec un `fetch` factice et des réponses enregistrées au format de l'API publique (`test/fixtures/scryfall/*.json`) : corps de `/cards/collection`, requête `oracleid` groupée et encodée, page unique et nouvelle recherche des cartes absentes d'une page pleine, 404 de recherche donnant une liste vide, 429 suivi d'une nouvelle tentative, délai d'attente, `toCardRow` sur une carte simple et sur une double face, `pickFrenchPrint` dans ses trois cas.
- `db-cards.ts` (SQLite en mémoire) : écriture et lecture du cache, mémorisation de « pas de FR », remplacement atomique du contenu d'un deck, commandant.
- `resolve.ts` : un paquet de bout en bout avec le faux Scryfall ; un second appel identique ne fait **aucun** appel réseau ; recherche par nom quand l'édition est introuvable.
- `commit.ts` : le résumé (total, % en français, introuvables) ; une ligne absente du cache est introuvable ; l'image du commandant est mise à jour.
- `groups.ts` : classement par type, priorités, tri.
- **Vérification réelle** : l'environnement de développement n'a pas accès à `api.scryfall.com`. Sauf autorisation réseau, l'import réel sera vérifié par l'utilisateur avec une liste de contrôles fournie.

## Déploiement

1. `npm run db:migrate:remote` (applique `0003_deck_cards.sql`).
2. Déployer.
