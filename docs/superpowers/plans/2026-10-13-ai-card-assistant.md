# Assistant IA pour les cartes — plan d'implémentation

> **Pour les agents :** chantier #137, une issue par tâche (#138 à #143, plus la tâche 4 bis #148 ajoutée le 14 octobre), dans l'ordre (chaque issue indique ses dépendances). Tests d'abord, cases à cocher (`- [ ]`).

**Objectif :** poser une question à Gemini sur une carte ou sur l'interaction entre plusieurs cartes, depuis la liste d'un deck, le mode test et la partie en ligne, et continuer dans un petit chat ; 20 questions par joueur et par jour.

**Architecture :** le navigateur n'envoie que des `oracle_id` et la conversation. Le serveur relit les cartes en D1 (anglais et français) et leurs règles (`loadRulings`), construit la consigne (`lib/ai/prompt.ts`, pur), compte la question (`ai_usage`), puis appelle Gemini (`lib/ai/gemini.ts`, `fetch` injecté). Côté interface, un contexte React (`components/ai/AiProvider.tsx`) garde les cartes choisies et la conversation ; la fenêtre « Oracle et règles », la page du deck et les menus de la table y ajoutent des cartes ; un seul panneau (`components/ai/AiPanel.tsx`) affiche le chat.

**Spec :** `docs/superpowers/specs/2026-10-13-ai-card-assistant-design.md`

## Contraintes globales

- Interface, messages d'erreur, commits et PR en français ; commits `type(portée): résumé`.
- Joueurs connectés seulement : routes en accès `'user'`, panneau et boutons masqués pour un visiteur.
- La clé Gemini ne quitte jamais le serveur : en-tête `x-goog-api-key`, jamais dans l'adresse ni dans une réponse ; rien de la réponse brute de Google n'est renvoyé au navigateur.
- Sans `GEMINI_API_KEY` : fonction désactivée (`enabled: false`, aucun bouton, `/api/ai/ask` → 503 « Assistant IA indisponible »).
- Migration `0015_ai_usage.sql` ajoutée à `MIGRATIONS` dans `test/d1.ts`, appliquée en production à la fusion. Table absente (site déployé avant la migration) : 503 propre, jamais de plantage.
- Informations cachées : « Ajouter à la question IA » seulement sur une carte visible qui a déjà « Oracle et règles » ; rien n'est envoyé au serveur de jeu ni aux autres joueurs ; aucun nouveau champ dans l'état de partie.
- Chaque tâche se termine par `npm test`, `npx tsc --noEmit` et `npx @cloudflare/next-on-pages` verts.

## Valeurs fixées

```ts
// lib/ai/limits.ts
export const AI_DAILY_QUOTA = 20
export const AI_MAX_CARDS = 10
export const AI_MAX_QUESTION_CHARS = 1000
export const AI_MAX_HISTORY = 10          // messages renvoyés à Gemini, nouvelle question comprise
export const AI_TIMEOUT_MS = 30_000
export const AI_TIME_ZONE = 'Europe/Paris'
```

Messages (dans `lib/ai/messages.ts`) :
- `AI_DISABLED = 'Assistant IA indisponible'`
- `AI_QUOTA_REACHED = 'Plus de questions pour aujourd’hui, à demain !'`
- `AI_NO_ANSWER = 'L’assistant IA ne répond pas, réessaie dans un moment'`
- `AI_UNKNOWN_CARD = 'Carte introuvable'`
- `AI_DISCLAIMER = 'Réponse générée par une IA : elle peut se tromper. Le texte Oracle et les règles font foi.'`

---

### Tâche 1 : compteur de questions et cartes par `oracle_id`

**Dépend de :** rien.

**Fichiers :**
- Créer : `migrations/0015_ai_usage.sql`, `lib/ai/limits.ts`, `lib/ai/messages.ts`, `lib/ai/quota.ts`, `lib/ai/quota.test.ts`, `lib/db-ai.ts`, `lib/db-ai.test.ts`
- Modifier : `test/d1.ts` (MIGRATIONS), `lib/db-cards.ts` (+ test)

**Interfaces produites :**
```ts
// lib/ai/quota.ts
parisDay(now: Date): string                       // 'AAAA-MM-JJ' du jour à Paris (Intl.DateTimeFormat, fr-CA)
// lib/db-ai.ts
getAiUsage(db, userId, day): Promise<Result<number>>                  // 0 si aucune ligne
takeAiQuestion(db, userId, day, quota): Promise<Result<number | null>> // compte la question ; restant après, null si quota atteint
giveBackAiQuestion(db, userId, day): Promise<Result<true>>             // jamais sous 0
// lib/db-cards.ts
getCardsByOracle(db, oracleIds: string[]): Promise<Result<Record<string, { en: CardRow; fr: CardRow | null }>>>
```

- [ ] **Étape 1 : migration**

```sql
-- Questions posées à l'assistant IA, par compte et par jour de Paris (spec 2026-10-13-ai-card-assistant-design).
-- Seul le nombre est gardé : ni questions ni réponses.
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
```

Ajouter `'0015_ai_usage.sql'` à `MIGRATIONS`.

- [ ] **Étape 2 : tests** : `parisDay` (23 h 30 UTC le 13 octobre → `2026-10-14` ; changement d'heure fin octobre) ; `takeAiQuestion` : 1re question → 19 restantes, 20e → 0, 21e → `null` sans changer le compteur, autre jour → 19, autre compte indépendant ; `giveBackAiQuestion` rend une question et ne descend pas sous 0 ; `getCardsByOracle` : carte anglaise seule, anglaise + française, `oracle_id` inconnu absent du résultat, plus de 100 identifiants (`MAX_BOUND_PARAMETERS`) découpés.
- [ ] **Étape 3 : code.** `takeAiQuestion` en une seule requête atomique :

```sql
INSERT INTO ai_usage (user_id, day, count) VALUES (?1, ?2, 1)
ON CONFLICT (user_id, day) DO UPDATE SET count = count + 1 WHERE count < ?3
RETURNING count
```

Aucune ligne renvoyée → `null` (quota atteint). Restant = `quota - count`. `getCardsByOracle` lit `cards` par `oracle_id` (`lang = 'en'` et `lang = 'fr'`, une impression par langue suffit).

- [ ] **Étape 4 : vérifications**, commit `feat(ia): compteur de questions et cartes par oracle_id`.

---

### Tâche 2 : consigne et client Gemini

**Dépend de :** rien (en parallèle de la tâche 1 possible ; reprend `lib/ai/limits.ts` et `messages.ts` si la tâche 1 n'est pas fusionnée : créer les mêmes fichiers à l'identique).

**Fichiers :**
- Créer : `lib/ai/types.ts`, `lib/ai/prompt.ts`, `lib/ai/prompt.test.ts`, `lib/ai/gemini.ts`, `lib/ai/gemini.test.ts`
- Modifier : `cloudflare-env.d.ts` (`GEMINI_API_KEY?: string`, `GEMINI_MODEL?: string`, `GEMINI_BASE_URL?: string`)

**Interfaces produites :**
```ts
// lib/ai/types.ts
export type ChatMessage = { role: 'user' | 'assistant'; text: string }
export type AiCard = { en: CardRow; fr: CardRow | null; rulings: Ruling[] }
// lib/ai/prompt.ts
SYSTEM_INSTRUCTION: string
cardsBlock(cards: AiCard[]): string
buildContents(cards: AiCard[], messages: ChatMessage[]): GeminiContent[]   // bloc des cartes en tête du 1er message user, historique tronqué à AI_MAX_HISTORY
// lib/ai/gemini.ts
export const DEFAULT_GEMINI_MODEL = '…'   // modèle Flash de l'offre gratuite, vérifié sur ai.google.dev au moment de coder
export class GeminiError extends Error { kind: 'quota' | 'timeout' | 'refused' | 'unavailable' }
createGeminiClient(deps: { fetch: typeof fetch; apiKey: string; model?: string; baseUrl?: string; timeoutMs?: number }): {
  ask(system: string, contents: GeminiContent[]): Promise<string>
}
```

- [ ] **Étape 1 : tests de `prompt.ts`** : carte simple (nom anglais, nom français, coût, type, Oracle, texte français, règles datées) ; carte recto verso (une section par face, via `oracleFaces`) ; sans texte français ; sans règles (« Aucune règle publiée ») ; la consigne demande le français, les noms français, de s'appuyer sur les textes fournis, de dire quand ils ne suffisent pas, et de rester sur Magic ; historique : rôles `user` / `model`, 10 derniers messages gardés, le bloc des cartes reste au début même après troncature.
- [ ] **Étape 2 : code de `prompt.ts`.**
- [ ] **Étape 3 : tests de `gemini.ts`** (faux `fetch`) : `POST {baseUrl}/v1beta/models/{model}:generateContent`, clé dans `x-goog-api-key` et **jamais** dans l'URL, corps `{ systemInstruction, contents, generationConfig }` ; réponse normale → texte des `parts` concaténé ; HTTP 429 → `GeminiError('quota')` ; délai dépassé (`AbortController`) → `'timeout'` ; `promptFeedback.blockReason` ou réponse vide → `'refused'` ; 5xx ou réseau → `'unavailable'`. `baseUrl` par défaut `https://generativelanguage.googleapis.com`.
- [ ] **Étape 4 : code de `gemini.ts`**, vérifications, commit `feat(ia): consigne et client Gemini`.

---

### Tâche 3 : routes `/api/ai/ask` et `/api/ai/quota`

**Dépend de :** tâches 1 et 2.

**Fichiers :**
- Créer : `lib/ai/ask.ts` (logique testable, dépendances injectées), `lib/ai/ask.test.ts`, `app/api/ai/ask/route.ts`, `app/api/ai/quota/route.ts`

**Interfaces produites :**
```ts
// lib/ai/ask.ts
parseAskBody(body: Record<string, unknown>): { ok: true; oracleIds: string[]; messages: ChatMessage[] } | { ok: false; error: string }
askAi(deps: { db; gemini: Pick<GeminiClient,'ask'> | null; rulings: (oracleId) => Promise<Ruling[]>; now: Date }, userId: string, oracleIds, messages)
  : Promise<{ status: 200; answer: string; remaining: number } | { status: 400 | 404 | 429 | 503; error: string; remaining?: number }>
// GET /api/ai/quota → { enabled: boolean; remaining: number }
// POST /api/ai/ask  → { answer, remaining } ou { error, remaining? }
```

- [ ] **Étape 1 : tests de `parseAskBody`** : 0 ou 11 cartes, `oracle_id` invalide (`isOracleId`), doublons retirés, aucun message, dernier message pas `user`, question vide ou de plus de 1 000 caractères, rôle inconnu → messages d'erreur français.
- [ ] **Étape 2 : tests de `askAi`** : sans client (pas de clé) → 503 `AI_DISABLED` sans compter ; carte inconnue → 404 sans compter ; quota atteint → 429 `AI_QUOTA_REACHED`, `remaining: 0`, Gemini pas appelé ; succès → réponse et restant ; `GeminiError` → 503 `AI_NO_ANSWER` et question rendue ; règles indisponibles → question posée sans règles ; table `ai_usage` absente → 503 `AI_NO_ANSWER`.
- [ ] **Étape 3 : code.** Ordre : validation → cartes (`getCardsByOracle`) → `takeAiQuestion` → règles (`loadRulings`, erreurs ignorées) → Gemini → en cas d'échec `giveBackAiQuestion`. Routes : `apiRoute(req, 'user', …)` ; client créé seulement si `env.GEMINI_API_KEY` ; `console.error('[ia]', kind)` sans la question ni la clé. `GET /api/ai/quota` : `enabled = !!env.GEMINI_API_KEY`, `remaining = AI_DAILY_QUOTA - getAiUsage` (base illisible → `remaining: AI_DAILY_QUOTA`).
- [ ] **Étape 4 : vérifications**, commit `feat(ia): routes de l'assistant IA`.

---

### Tâche 4 : panneau de l'assistant, fenêtre Oracle et page du deck

**Dépend de :** tâche 3.

**Fichiers :**
- Créer : `components/ai/AiProvider.tsx` (contexte), `components/ai/AiPanel.tsx`, `components/ai/state.ts` + `state.test.ts` (réducteur pur : ajouter / retirer une carte, max 10, ajouter un message, nouvelle question, suggestions)
- Modifier : `components/OracleModal.tsx` (bouton « Demander à l'IA »), `app/decks/[id]/DeckView.tsx` et `page.tsx` (bouton « Assistant IA », fournisseur), `app/layout.tsx` seulement si le fournisseur y est plus simple (sinon un fournisseur par page)

**Interfaces produites :**
```ts
// components/ai/AiProvider.tsx
export type AiCardRef = { oracleId: string; name: string; gathererUrl: string }
useAi(): { enabled: boolean; open(card?: AiCardRef): void; addCard(card: AiCardRef): void } | null   // null hors fournisseur ou visiteur
```

- [ ] **Étape 1 : tests du réducteur** : ajout d'une carte déjà présente sans doublon ; 11e carte refusée (« 10 cartes au plus ») ; retrait ; « Nouvelle question » vide la conversation et garde les cartes ; suggestions : 1 carte → « Explique cette carte », 2 et plus → « Comment ces cartes interagissent-elles ? ».
- [ ] **Étape 2 : fournisseur et panneau** selon la spec : `GET /api/ai/quota` à l'ouverture (désactivé → rien d'affiché) ; pastilles des cartes (nom français si connu) avec croix ; suggestions ; bulles (texte brut, `whitespace-pre-line`, listes `- ` rendues en liste, jamais de HTML interprété) ; liens Gatherer des cartes choisies sous chaque réponse ; `AI_DISCLAIMER` fixe ; compteur « N questions restantes aujourd'hui » ; à 0 saisie désactivée et `AI_QUOTA_REACHED` ; « L'IA réfléchit… » et envoi désactivé pendant l'attente ; erreur affichée dans le fil, la question reste dans la saisie. Panneau à droite (largeur 380 px, `z-index` au-dessus de la table) sur ordinateur et tablette, plein écran sous 640 px ; « Fermer » garde la conversation.
- [ ] **Étape 3 : fenêtre Oracle** : prop facultative `onAskAi?: () => void` ; bouton « Demander à l'IA » affiché seulement si fournie. **Page du deck** : fournisseur si un joueur est connecté ; bouton « Assistant IA » en haut de la liste ; « Demander à l'IA » dans la fiche Oracle d'une carte.
- [ ] **Étape 4 : vérifications** (dont `playtest-check` et `deck-link-check` pour s'assurer que rien ne casse), commit `feat(ia): panneau de l'assistant sur la page du deck`.

---

### Tâche 4 bis : interrupteur et utilisation du jour dans l'administration (#148)

**Dépend de :** tâche 4. **Avant** la tâche 5 (décision du 14 octobre).

**Fichiers :**
- Créer : `migrations/0016_site_settings.sql`, `lib/db-settings.ts` (+ test), `lib/ai/switch.ts` (+ test), `app/api/admin/ai/route.ts`, `components/admin/AiSettingsPanel.tsx`
- Modifier : `test/d1.ts` (MIGRATIONS), `lib/db-ai.ts` (+ test : `getAiUsageOfDay`), `lib/ai/server.ts` (disponibilité = clé **et** interrupteur), `app/api/ai/ask/route.ts`, `app/api/ai/quota/route.ts`, `app/admin/page.tsx`, `app/admin/AdminDashboard.tsx`

**Interfaces produites :**
```ts
// lib/db-settings.ts
getSetting(db, key): Promise<Result<string | null>>
setSetting(db, key, value, now): Promise<Result<true>>
// lib/ai/switch.ts
AI_SWITCH_KEY = 'ai_enabled'
isAiSwitchedOn(db): Promise<boolean>          // ligne absente ou base illisible → true
setAiSwitch(db, enabled, now): Promise<Result<true>>
// lib/db-ai.ts
getAiUsageOfDay(db, day): Promise<Result<{ questions: number; players: number }>>
// lib/ai/server.ts
aiAvailable(env): Promise<boolean>             // clé présente et interrupteur activé
askDeps(env, now): Promise<AskDeps>            // gemini null si indisponible
```

- [ ] **Étape 1 : migration** `CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`, ajoutée à `MIGRATIONS`.
- [ ] **Étape 2 : tests** : réglage absent → null ; écrit puis relu ; réécrit ; interrupteur par défaut activé, désactivé puis réactivé, table absente → activé ; utilisation du jour (0 / 0, puis 3 questions par 2 joueurs, autre jour ignoré) ; `askDeps` sans client Gemini quand l'interrupteur est coupé.
- [ ] **Étape 3 : code**, route admin (`apiRoute(req, 'admin', …)`, `enabled` booléen sinon 400), section du tableau de bord (données lues côté serveur, bouton qui appelle `PATCH`, message en français).
- [ ] **Étape 4 : vérifications** + navigateur : admin `e2e-1` coupe l'assistant → bouton « Assistant IA » absent pour `e2e-2` au rechargement, `/api/ai/ask` → 503 ; réactive → bouton de retour ; compteur du jour à jour. Commit `feat(ia): interrupteur et utilisation du jour dans l'administration`.

---

### Tâche 5 : l'assistant à la table (mode test, partie en ligne, fenêtre de plateau)

**Dépend de :** tâche 4.

**Fichiers :**
- Modifier : `lib/game/menus.ts` (+ `menus.test.ts`), `components/table/Table.tsx`, les pages du mode test et de la partie en ligne (fournisseur), `components/online/BoardWindow.tsx` si elle n'hérite pas déjà du fournisseur

**Interfaces produites :**
```ts
// lib/game/menus.ts
| { kind: 'askAi'; owner: string; ref: number }   // nouvelle commande de menu, côté navigateur seulement
// MenuContext : ai?: boolean   // entrée affichée seulement si l'assistant est disponible
```

- [ ] **Étape 1 : tests des menus** : « Ajouter à la question IA » juste après « Oracle et règles », seulement dans les mêmes cas (carte visible, ni face cachée ni jeton, catalogue reçu) et seulement si `ctx.ai` ; absente pour une carte face cachée d'un adversaire, une carte de sa main vue par un autre, un jeton.
- [ ] **Étape 2 : code** : `oracleEntries` ajoute l'entrée ; `Table.tsx` traite `askAi` (catalogue → `addCard` puis ouverture du panneau) et passe `onAskAi` à la fenêtre Oracle ; fournisseur ajouté au mode test et à la partie en ligne ; la fenêtre de plateau d'un adversaire a son propre panneau (sa propre page).
- [ ] **Étape 3 : vérifications** : `npm test`, `tsc`, build, `playtest-check`, `playtest-tablet-check`, `online-check`, `board-window-check` (rien ne casse sans clé : entrée absente). Commit `feat(ia): assistant IA depuis les cartes de la table`.

---

### Tâche 6 : vérification navigateur et documentation

**Dépend de :** tâche 5.

**Fichiers :**
- Créer : `scripts/fake-gemini.mjs` (faux serveur local : répond « Réponse de test pour : <question> », 429 si la question contient `#quota`, attend 35 s si elle contient `#lent`), `scripts/ai-check.mjs`, `docs/assistant-ia.md`
- Modifier : `CLAUDE.md` (ligne `ai-check`), `docs/superpowers/roadmap.md`

- [x] **Étape 1 : `scripts/ai-check.mjs`** (site lancé avec `GEMINI_API_KEY=test` et `GEMINI_BASE_URL=http://localhost:8790` dans `.dev.vars`) : visiteur → aucun bouton ; page d'un deck → Oracle → « Demander à l'IA » → suggestion → réponse affichée, compteur 19 ; deuxième message dans le même chat ; mode test → menu d'une carte en main → « Ajouter à la question IA » → deux pastilles ; partie en ligne à 2 → ajouter une carte adverse visible, vérifier l'absence de l'entrée sur une carte face cachée adverse ; erreur Google (`#quota`) → message français et compteur inchangé ; compteur mis à 20 en base → saisie désactivée et message ; téléphone 390 × 844 → panneau plein écran ; aucune requête du navigateur ne contient la clé.
- [x] **Étape 2 : `docs/assistant-ia.md`** pour l'utilisateur, depuis le téléphone : créer la clé sur aistudio.google.com (compte Google, « Get API key ») ; Cloudflare → Workers & Pages → `dc-league` → Settings → Variables and Secrets : `GEMINI_API_KEY` (type Secret, production et aperçu), `GEMINI_MODEL` facultatif ; redéployer ; vérifier ; quotas gratuits de Google et ce qui se passe quand ils sont atteints ; confidentialité (Google peut réutiliser questions et réponses de l'offre gratuite ; seuls la question et les textes des cartes partent, aucun nom ni compte) ; désactiver = supprimer la clé.
- [x] **Étape 3 : feuille de route** : chantier 15 « fait », vérifications à faire après déploiement (créer la clé, question réelle Teferi, Time Raveler + contre-sort, qualité du français). `CLAUDE.md` : ligne `node scripts/ai-check.mjs …`.
- [x] **Étape 4 : vérifications complètes** (toutes celles de `CLAUDE.md`), commit `docs(ia): guide de la clé Gemini et vérification navigateur`.
