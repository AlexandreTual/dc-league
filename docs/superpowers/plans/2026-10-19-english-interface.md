# Site en anglais (interface et cartes) — plan d'implémentation

> **Pour les agents :** une issue par tâche, dans l'ordre (chaque tâche indique ses dépendances). Tests d'abord, cases à
> cocher (`- [ ]`). Les tâches 2 à 9 ne dépendent que de la tâche 1 et peuvent être faites dans n'importe quel ordre,
> sauf mention contraire ; la tâche 10 vient en dernier.

**Objectif :** deux réglages séparés, langue de l'interface (cookie, lue par le serveur) et langue des cartes
(`localStorage`, comme aujourd'hui), et tout le texte du site disponible en français et en anglais.

**Architecture :** dictionnaires typés sans bibliothèque (`lib/i18n/`), `getLang()` côté serveur, `I18nProvider` +
`useT()` côté navigateur, dictionnaire passé en paramètre aux fonctions pures de `lib/`. Journal de partie structuré
(`LogEntry.msg`), traduit à l'affichage.

**Spec :** `docs/superpowers/specs/2026-10-19-english-interface-design.md`

## Contraintes globales

- Commits et PR en français ; commits `type(portée): résumé` (portée `i18n` pour le socle).
- Le français affiché ne change pas : chaque tâche remplace des textes en dur par `t.…` sans retoucher les phrases
  françaises (les scripts navigateur existants doivent rester verts sans modification de leurs sélecteurs de texte).
- `en: Messages` : TypeScript refuse toute clé manquante ou en trop. Vocabulaire anglais : tableau de la spec.
- Pas de nouvelle dépendance, pas de migration, pas de nouveau secret.
- Serveur de jeu plus ancien : `msg` absent → `text` ; erreurs inconnues affichées telles quelles.
- Informations cachées : aucune donnée de carte en plus dans `viewFor` ; un paramètre `card` du journal seulement là où
  la phrase contenait déjà le nom, avec la même visibilité.
- Chaque tâche se termine par `npm test`, `npx tsc --noEmit`, `npx @cloudflare/next-on-pages`, les scripts navigateur
  qu'elle touche, et `scripts/i18n-check.mjs` étendu aux pages de la tâche.

## Valeurs fixées

```ts
// lib/i18n/lang.ts
export type Lang = 'fr' | 'en'
export const LANGS: Lang[] = ['fr', 'en']
export const UI_LANG_COOKIE = 'dc_lang'
export const UI_LANG_MAX_AGE = 365 * 24 * 3600
export const DEFAULT_LANG: Lang = 'fr'
export const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' }
// lib/cards/lang.ts (inchangé)
export const LANG_KEY = 'dc-card-lang'
```

Forme du dictionnaire :

```ts
// lib/i18n/messages/fr.ts
export const fr = {
  common: { close: 'Fermer', cancel: 'Annuler', save: 'Enregistrer', loading: 'Chargement…' },
  language: { title: 'Language / Langue', interface: 'Interface', cards: 'Cartes' },
  nav: { league: 'Ligue', play: 'Jouer', myDecks: 'Mes decks', rules: 'Règles', login: 'Connexion' },
  table: { turn: (n: number) => `Tour ${n}`, endTurn: 'Fin de tour', draw: 'Piocher' /* … */ },
  // …
}
export type Messages = typeof fr
// lib/i18n/messages/en.ts
export const en: Messages = { common: { close: 'Close', cancel: 'Cancel', save: 'Save', loading: 'Loading…' }, /* … */ }
```

---

### Tâche 1 : socle et sélecteur de langue

**Dépend de :** rien.

**Fichiers :**
- Créer : `lib/i18n/lang.ts` (+ test), `lib/i18n/messages/fr.ts`, `lib/i18n/messages/en.ts`, `lib/i18n/messages.test.ts`,
  `lib/i18n/server.ts`, `components/i18n/I18nProvider.tsx`, `components/i18n/LanguageMenu.tsx`, `scripts/i18n-check.mjs`
- Modifier : `app/layout.tsx`, `components/Navbar.tsx`, `components/UserMenu.tsx`, `lib/nav.ts` (+ test),
  `lib/cards/lang.ts` (+ test), `components/table/TopBar.tsx`, `components/table/Table.tsx` (bouton FR/EN de la fenêtre
  d'un plateau), `app/decks/[id]/DeckView.tsx`, les scripts navigateur existants (cookie `dc_lang=fr`)

**Interfaces produites :**
```ts
// lib/i18n/lang.ts (pur)
pickLang(cookie: string | undefined, acceptLanguage: string | null): Lang
isLang(v: unknown): v is Lang
formatDate(d: Date | string, lang: Lang, opts?: Intl.DateTimeFormatOptions): string
// lib/i18n/messages.ts
messages(lang: Lang): Messages
// lib/i18n/server.ts
getLang(): Promise<Lang>                 // cookies() puis headers() de next/headers
getMessages(): Promise<Messages>
// components/i18n/I18nProvider.tsx
useI18n(): { lang: Lang; t: Messages; setLang(l: Lang): void; cardLang: Lang; setCardLang(l: Lang): void }
useT(): Messages
useCardLang(): [Lang, (l: Lang) => void]
// lib/cards/lang.ts
readLang(fallback: Lang): Lang           // valeur retenue, sinon fallback (la langue de l'interface)
```

- [ ] **Étape 1 : tests.** `pickLang` : cookie `en` → en ; cookie invalide ignoré ; `fr-FR,fr;q=0.9,en;q=0.8` → fr ;
  `en-US,en;q=0.9,fr;q=0.8` → en ; `de-DE,de;q=0.9` → en ; `de,fr;q=0.5` → fr ; en-tête absent → fr ; poids `q`
  respectés quel que soit l'ordre. `readLang(fallback)` : rien de retenu → fallback ; stockage indisponible → fallback.
  `mainLinks(user, t)` en `en`. Dictionnaires : aucune valeur anglaise identique au français hors liste blanche
  (parcours récursif, fonctions appelées avec des valeurs d'exemple).
- [ ] **Étape 2 : code.** Layout : `const lang = await getLang()`, `<html lang={lang}>`, `generateMetadata` traduit,
  `<I18nProvider lang={lang}>` autour de la barre et de la page. `setLang` : `document.cookie = 'dc_lang=…; path=/;
  max-age=…; samesite=lax'`, état mis à jour, `router.refresh()`. `cardLang` : `readLang(lang)` au montage,
  `setCardLang` appelle `saveLang`.
- [ ] **Étape 3 : `LanguageMenu`** (bulle de la spec ; `data-testid="language-menu"`, boutons
  `data-testid="ui-lang-fr|en"` et `card-lang-fr|en`, `aria-pressed`). Posé dans la barre du site, dans `TopBar`, dans la
  barre de la fenêtre d'un plateau et sur la page d'un deck (l'état local `lang` de `Table` et `DeckView` est remplacé
  par `useCardLang()`). Barre du site, menu du compte et `lib/nav.ts` traduits.
- [ ] **Étape 4 : `scripts/i18n-check.mjs`** : accueil, ligues, règles en visiteur ; détection `Accept-Language`
  (contexte `locale: 'en-US'` → anglais, `fr-FR` → français) ; bascule interface seule puis cartes seules sur la page
  d'un deck et en mode test (un nom de carte français reste avec l'interface anglaise, et l'inverse) ; détecteur de
  français (lettres accentuées, mots « le, la, les, des, du, une, pour, avec, sur, dans ») sur le texte visible hors
  éléments `[data-user-content]` et hors cartes, page par page ; liste des pages à étendre à chaque tâche. Les scripts
  existants posent le cookie `dc_lang=fr` avant d'ouvrir le site.
- [ ] **Étape 5 :** vérifications complètes, `home-nav-check`, `playtest-check`, `board-window-check`.

### Tâche 2 : table de jeu — barre, colonne, fenêtres

**Dépend de :** tâche 1.

**Fichiers :** `components/table/*.tsx` sauf `CardMenu.tsx` et `LogPanel.tsx`/`ActivityFeed.tsx` (barre, colonne et
portrait, bandeaux, piles, `PileModal`, `OrderModal`, `DiceModal`, `TokenModal`, `TableSettings`, `ShortcutsModal`,
`abilities.tsx`, `ManaPool`, `PreviewPane`, `StartDraw`, `GameCard` : « Hors phase », encarts), `components/table/
visio/VisioPanel.tsx`, `lib/game/abilities.ts` (noms anglais officiels des 43 capacités), `lib/game/player-markers.ts`,
`lib/game/player-badges.ts`, `lib/game/player-summary.ts`, `lib/game/keyboard.ts` (descriptions), `lib/game/dice.ts`
(textes), `components/table/fullscreen.ts` (messages) et leurs tests.

- [ ] **Étape 1 : tests** des fonctions pures en `en` (capacités : `Flying`, `Protection from red`, `Ward {2}`,
  `Annihilator 2` ; marqueurs : `Energy`, `Experience` ; badges ; raccourcis).
- [ ] **Étape 2 : code.** `t` passé aux fonctions pures ; libellés, `title`, `aria-label` et textes d'aide traduits.
  Les touches des raccourcis ne changent pas.
- [ ] **Étape 3 :** `playtest-check`, `playtest-tablet-check`, `abilities-check`, `pt-check`, `loyalty-check`,
  `dice-check`, `shortcuts-check`, `selection-check`, `visio-check` en français ; `i18n-check` étendu au mode test
  (barre, réglages, chaque fenêtre ouverte une fois).

### Tâche 3 : menus des cartes et des piles

**Dépend de :** tâche 1.

**Fichiers :** `lib/game/menus.ts` (+ test), `lib/game/selection.ts` (menu d'un groupe), `components/table/CardMenu.tsx`,
appelants de `MenuContext`.

- [ ] **Étape 1 : tests.** `MenuContext` reçoit `t: Messages` ; les tests existants passent `fr` sans changer leurs
  attentes ; nouveaux cas `en` : `Tap`, `Phase out`, `Give control to Bob`, `Send to` / `Top of library`, `Look at the
  top X…`, `How many cards?`, `Commander tax`, menu d'un groupe.
- [ ] **Étape 2 : code.** `DESTINATIONS` et tous les libellés depuis `t.menus` ; `ctx.lang` reste la langue des cartes.
- [ ] **Étape 3 :** `playtest-check`, `selection-check`, `phasing-check` ; `i18n-check` ouvre le menu d'une carte de
  chaque zone en anglais.

### Tâche 4 : jeu en ligne — salon, salle d'attente, erreurs

**Dépend de :** tâche 1.

**Fichiers :** `app/salon/page.tsx`, `components/online/*.tsx`, `app/tables/[id]/plateau/[joueur]/page.tsx`,
`lib/game/first-player.ts`, `lib/game/room.ts` (textes), nouveau `lib/i18n/game-errors.ts` (+ test).

**Interfaces produites :**
```ts
// lib/i18n/game-errors.ts (pur)
translateGameError(message: string, t: Messages): string   // message français du moteur ou du serveur de jeu → langue de t ; inconnu → tel quel
```

- [ ] **Étape 1 : tests.** Tous les messages d'erreur de `lib/game/validate.ts`, `lib/game/apply.ts` (`canApply`),
  `lib/game/room.ts` et `workers/game/runtime.ts` sont recensés par le test (lecture des sources, motifs entre
  guillemets) et ont une traduction ; message inconnu rendu tel quel ; messages à valeur (« … n'existe plus »).
- [ ] **Étape 2 : code.** Salon, salle d'attente, tirage du premier joueur, fin de partie, fenêtre d'un plateau, erreurs
  affichées par `useGameSocket` passées par `translateGameError`.
- [ ] **Étape 3 :** `online-check`, `first-player-check`, `board-window-check` ; `i18n-check` : partie en ligne à deux
  joueurs, l'un en français, l'autre en anglais, chacun voit sa langue.

### Tâche 5 : journal de partie traduit

**Dépend de :** tâches 1 et 3 (vocabulaire des zones).

**Fichiers :** `lib/game/types.ts`, `lib/game/apply.ts` (+ tests), `lib/game/view.ts`, `lib/game/activity.ts`, nouveau
`lib/game/log-format.ts` (+ test), `components/table/LogPanel.tsx`, `components/table/ActivityFeed.tsx`.

**Interfaces produites :**
```ts
// lib/game/types.ts
type LogMessage = { key: LogKey; params?: Record<string, LogParam> }
// lib/game/log-format.ts (pur)
formatLog(entry: { text: string; msg?: LogMessage }, t: Messages, cardLang: Lang, view: PlayerView): string
```

- [ ] **Étape 1 : tests.** Pour chacune des ~40 lignes de `apply.ts` : `formatLog(…, fr)` redonne exactement `text`
  (même phrase qu'aujourd'hui) ; `en` donne la phrase anglaise ; noms de cartes dans la langue des cartes demandée ;
  carte face cachée jamais nommée ; ligne sans `msg` → `text` ; paramètre `card` absent de toute ligne dont `text`
  ne nomme pas la carte (test de non-fuite sur `viewFor`).
- [ ] **Étape 2 : code.** `log(state, actor, text, visibleTo, msg?)` ; chaque appel donne `msg`. `viewFor` transmet
  `msg`. `LogPanel` et `ActivityFeed` affichent `formatLog`.
- [ ] **Étape 3 :** compatibilité vérifiée avec `npm run game:dev` lancé depuis un `git worktree` de `main` (lignes en
  français, rien ne plante) ; `online-check`, `dice-check`, `phasing-check` ; `i18n-check` : journal en anglais chez
  le joueur anglais, en français chez l'autre, noms des cartes selon la langue des cartes de chacun.

### Tâche 6 : pages publiques et ligues

**Dépend de :** tâche 1.

**Fichiers :** `app/page.tsx`, `app/ligues/**`, `app/classement`, `app/calendar`, `app/playoffs`, `app/stats`,
`app/history/**`, `app/rules/page.tsx`, `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`,
`components/LeaderboardTable.tsx`, `components/LeagueTabs.tsx`, `components/MatchCard.tsx`, `components/ScoreModal.tsx`,
`components/LoadError.tsx`, `components/leagues/*` (+ `format.test.ts`), `lib/leagues/validation.ts`.

- [ ] **Étape 1 : tests** des fonctions de format (`components/leagues/format.ts`) en `en`, dates au format anglais.
- [ ] **Étape 2 : code.** Pages serveur avec `getMessages()`, composants client avec `useT()` ; dates par
  `formatDate(…, lang)` ; règles de la ligue traduites en entier.
- [ ] **Étape 3 :** `home-nav-check`, `leagues-check` ; `i18n-check` étendu (toutes ces pages, visiteur et joueur).

### Tâche 7 : comptes, profil et decks

**Dépend de :** tâche 1.

**Fichiers :** `app/connexion/**`, `app/mot-de-passe-oublie/**`, `app/invitation/**`, `app/profil/**`,
`app/decks/**`, `components/decks/*`, `components/OracleModal.tsx`, `components/PlayerName.tsx`,
`lib/auth/validation.ts`, `lib/cards/groups.ts` (titres des groupes : Créatures → Creatures…), `lib/cards/deck-view.ts`.

- [ ] **Étape 1 : tests** des fonctions pures touchées en `en` (groupes d'un deck, messages de validation).
- [ ] **Étape 2 : code.**
- [ ] **Étape 3 :** `deck-link-check`, `mail-check` (en français) ; `i18n-check` étendu (connexion, mot de passe
  oublié, invitation, profil, mes decks, page d'un deck, import, « Oracle et règles »).

### Tâche 8 : administration

**Dépend de :** tâche 1.

**Fichiers :** `app/admin/**`, `components/admin/*`.

- [ ] **Étape 1 : code** (pas de logique nouvelle) ; dates par `formatDate`.
- [ ] **Étape 2 :** `admin-games-check`, `home-nav-check` (admin) ; `i18n-check` étendu (compte `e2e-1` admin).

### Tâche 9 : erreurs des routes, mails et assistant IA

**Dépend de :** tâche 1 (et 7 pour le formulaire d'invitation).

**Fichiers :** `app/api/**/route.ts`, `lib/auth/api-core.ts`, `lib/auth/service.ts`, `lib/ai/messages.ts`,
`lib/ai/prompt.ts`, `lib/ai/ask.ts`, `app/api/ai/ask/route.ts`, `components/ai/*`, `lib/mail/templates.ts`,
`app/api/auth/forgot/route.ts`, `app/api/admin/invitations/route.ts`, `components/admin/AccountsPanel.tsx`
(choix de la langue de l'invitation), et leurs tests.

**Interfaces produites :**
```ts
// lib/mail/templates.ts
invitationMail(input: MailInput, lang: Lang): MailContent
resetMail(input: MailInput, lang: Lang): MailContent
// lib/ai/prompt.ts
systemInstruction(lang: Lang): string
```

- [ ] **Étape 1 : tests.** Mails en `en` (sujet, texte, `<html lang="en">`) ; consigne IA en `en` (« Answer in
  English ») sans les noms français quand l'interface et les cartes sont en anglais ; une route renvoie son erreur en
  anglais avec le cookie `dc_lang=en` et en français sans cookie ; invitation : champ `lang` validé (`fr` par défaut).
- [ ] **Étape 2 : code.** Les services renvoient des clés d'erreur (`errors.…`) traduites par la route avec
  `getLang()` ; la langue de l'IA vient du cookie de la requête ; panneau IA traduit.
- [ ] **Étape 3 :** `mail-check` et `ai-check` en français, puis un passage en anglais (mail « Forgot password »,
  réponse du faux Gemini avec la consigne anglaise).

### Tâche 10 : vérification d'ensemble et documentation

**Dépend de :** tâches 1 à 9.

- [ ] `scripts/i18n-check.mjs` complet : tout le site en anglais sans texte français, combinaisons des deux réglages,
  partie en ligne à deux langues, tablette (1180×820).
- [ ] Tous les scripts navigateur de `CLAUDE.md` en français.
- [ ] `CLAUDE.md` : ligne `i18n-check`, règle « tout nouveau texte passe par `lib/i18n` (français et anglais) » ;
  `docs/superpowers/roadmap.md` : chantier terminé.
