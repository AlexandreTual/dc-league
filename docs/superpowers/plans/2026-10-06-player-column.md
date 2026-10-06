# Colonne joueur façon MTGO — plan

> **Pour les agents :** exécuter tâche par tâche, une issue et une PR par tâche, dans l'ordre (chacune dépend de la précédente : mêmes fichiers de la table). Cases à cocher (`- [ ]`) pour le suivi.

**But :** rendre la vie et le cimetière visibles d'un coup d'œil : un bloc par joueur sur le bord gauche de son plateau (ligne portrait avec la vie en gros, cases chiffrées, commandant, cimetière en cascade), et le même en-tête, en compact, sur les bandeaux adverses.

**Architecture :** nouveaux composants dans `components/table/`, posés **à l'intérieur** des plateaux existants (`MyBoard`, `OpponentBoard`) et des bandeaux (`OpponentStrip`). Les repères des scripts restent donc dans `data-board` et `data-strip`. Un module pur testé avec Vitest, `lib/game/player-summary.ts`, porte les règles d'affichage. Le moteur ne change pas : aucun nouveau champ dans l'état de partie, compatible avec le serveur de jeu en production.

**Spec :** `docs/superpowers/specs/2026-10-06-player-column-design.md` (issue #80).

**Pile :** Next.js 15 (edge), React, Tailwind, @dnd-kit/core, Vitest, playwright-core pour les contrôles navigateur.

## Contraintes communes

- Interface, messages et commits en français ; commit `type(portée): résumé`, PR qui ferme l'issue de la tâche (`Closes #N`).
- Repères à garder (le glisser-déposer et les scripts s'en servent) : `data-board`, `data-strip`, `data-panel`, `data-bubble`, `data-zone` + `data-player` + `data-count`, `data-card-id`, `data-strip-card`, `data-row`, `data-badge`, `data-testid` `player-name`, `player-life`, `hand-count`, `commander-damage-<joueur>`.
- **Un seul élément par zone et par joueur porte `data-zone`** : celui qui contient les cartes (voir le tableau du §4 de la spec). Une seconde cible de dépôt pour la même zone (case Cim.) passe par `useZone(ref, 'case')`, sans `data-zone`.
- Les boutons de vie gardent les noms accessibles « moins : points de vie » et « plus : points de vie », et Maj + clic = ±5.
- Vérifications de chaque tâche : `npm test`, `npx tsc --noEmit`, `npm run lint`, `npx @cloudflare/next-on-pages`, puis `playtest-check`, `playtest-mobile-check` et `online-check` (voir `CLAUDE.md`). Captures jointes à la PR : mode test, Duel et 4 joueurs, en 1600 × 1000 et 1280 × 720.

---

## Tâche 1 : ma colonne (#83)

**Décidé (#83) :** en mode test, la vie n'est que dans ma colonne (spec §5).

**Fichiers :**
- Créer : `lib/game/player-summary.ts`, `lib/game/player-summary.test.ts`
- Créer : `components/table/PlayerPortrait.tsx` (ligne portrait + bulle, reprise de `PlayerPill`)
- Créer : `components/table/PileCases.tsx` (`PileCases`, `CommandBlock`, `GraveyardCascade`, `GraveyardLast`)
- Créer : `components/table/PlayerColumn.tsx`
- Modifier : `components/table/zones.tsx` (exporter `useZone` avec une clé facultative, et `cardProps`)
- Modifier : `components/table/MyBoard.tsx`, `components/table/Table.tsx`, `components/table/TopBar.tsx` (la vie quitte la barre)
- Modifier : `scripts/playtest-check.mjs`, `scripts/online-check.mjs`

**Interfaces produites :**
- `LOW_LIFE = 10`, `GRAVEYARD_TAIL = 6`
- `lifeLevel(life: number): 'normal' | 'low'`
- `graveyardTail(cards: CardView[], n = GRAVEYARD_TAIL): VisibleCard[]` : les `n` dernières cartes visibles, la plus récente en dernier
- `portraitCard(view: PlayerView, player: string): VisibleCard | null` : le premier commandant du joueur trouvé dans ses zones visibles, dans l'ordre commandement, champ de bataille, cimetière, exil, main
- `commanderPlace(view: PlayerView, id: string): string | null` : « zone de commandement », « en jeu », « au cimetière », « en exil », « en main », ou `null` si la carte n'est pas visible
- `frameOf(colors: string[], typeLine: string): 'W' | 'U' | 'B' | 'R' | 'G' | 'multi' | 'land' | 'colorless'` : couleur du liseré d'une carte de la cascade
- `<PlayerPortrait size="column" | "header" up? … />` : mêmes props que `PlayerPill` plus `size` ; pose `data-panel`, `player-name`, `player-life`
- `<PlayerColumn {...zoneProps} player me up onLibraryMenu onPile />`

- [x] **Étape 1 : tests qui échouent.** `lib/game/player-summary.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { viewFor } from './view'
import { commanderPlace, frameOf, graveyardTail, lifeLevel, portraitCard } from './player-summary'

const game = () => run(setupFor('commander', 2), start(1))
const forests = (n: number) => Array.from({ length: n }, (_, i) => ({ id: card('p1', 3, i + 1), player: 'p1', zone: 'graveyard' as const }))

describe('lifeLevel', () => {
  it('rouge à 10 ou moins', () => {
    expect(lifeLevel(11)).toBe('normal')
    expect(lifeLevel(10)).toBe('low')
    expect(lifeLevel(0)).toBe('low')
    expect(lifeLevel(-3)).toBe('low')
  })
})

describe('graveyardTail', () => {
  it('les 6 dernières, la plus récente en dernier', () => {
    const view = viewFor(place(game(), forests(8)), 'p1')
    const ids = graveyardTail(view.players.p1.zones.graveyard).map((c) => c.id)
    expect(ids).toEqual([3, 4, 5, 6, 7, 8].map((n) => card('p1', 3, n)))
  })

  it('moins de 6 cartes : toutes ; cimetière vide : aucune', () => {
    const view = viewFor(place(game(), forests(2)), 'p2')
    expect(graveyardTail(view.players.p1.zones.graveyard)).toHaveLength(2)
    expect(graveyardTail(view.players.p2.zones.graveyard)).toEqual([])
  })
})

describe('portraitCard et commanderPlace', () => {
  it('le commandant en zone de commandement, vu par l’adversaire', () => {
    const view = viewFor(game(), 'p2')
    expect(portraitCard(view, 'p1')?.id).toBe(card('p1', 1))
    expect(commanderPlace(view, card('p1', 1))).toBe('zone de commandement')
  })

  it('suit le commandant sur le champ de bataille et au cimetière', () => {
    const onField = place(game(), [{ id: card('p1', 1), player: 'p1', zone: 'battlefield' }])
    expect(commanderPlace(viewFor(onField, 'p2'), card('p1', 1))).toBe('en jeu')
    const dead = place(game(), [{ id: card('p1', 1), player: 'p1', zone: 'graveyard' }])
    expect(commanderPlace(viewFor(dead, 'p2'), card('p1', 1))).toBe('au cimetière')
  })

  it('commandant invisible (mélangé dans la bibliothèque) : pas de portrait', () => {
    const view = viewFor(place(game(), [{ id: card('p1', 1), player: 'p1', zone: 'library' }]), 'p2')
    expect(portraitCard(view, 'p1')).toBeNull()
    expect(commanderPlace(view, card('p1', 1))).toBeNull()
  })
})

describe('frameOf', () => {
  it('une couleur, plusieurs, terrain, incolore', () => {
    expect(frameOf(['R'], 'Instant')).toBe('R')
    expect(frameOf(['W', 'U'], 'Creature')).toBe('multi')
    expect(frameOf([], 'Basic Land — Forest')).toBe('land')
    expect(frameOf([], 'Artifact')).toBe('colorless')
  })
})
```

Le deck de test (`test/factories.ts`) place Kenrith en zone de commandement au départ (`lib/game/setup.ts`). Les deux formats (`'commander' | 'duel'`) ont des commandants.

- [x] **Étape 2 :** `npx vitest run lib/game/player-summary.test.ts` → échec (module absent).

- [x] **Étape 3 : implémenter `lib/game/player-summary.ts`.**

```ts
// Règles d'affichage de la colonne joueur : vie basse, cascade du cimetière, portrait, emplacement d'un commandant.
import type { CardView, PlayerView, PlayerZone, VisibleCard } from './types'

export const LOW_LIFE = 10
export const GRAVEYARD_TAIL = 6

export const lifeLevel = (life: number): 'normal' | 'low' => (life <= LOW_LIFE ? 'low' : 'normal')

const visible = (cards: CardView[]) => cards.filter((c): c is VisibleCard => !c.hidden)

/** Les `n` dernières cartes visibles du cimetière, la plus récente en dernier (en bas de la cascade). */
export function graveyardTail(cards: CardView[], n = GRAVEYARD_TAIL): VisibleCard[] {
  return visible(cards).slice(-n)
}

const PLACES: [Exclude<PlayerZone, 'library'>, string][] = [
  ['command', 'zone de commandement'], ['battlefield', 'en jeu'], ['graveyard', 'au cimetière'], ['exile', 'en exil'], ['hand', 'en main'],
]

/** Premier commandant du joueur visible dans les zones publiques ou connues. */
export function portraitCard(view: PlayerView, player: string): VisibleCard | null {
  for (const p of Object.values(view.players)) {
    for (const [zone] of PLACES) {
      const found = visible(p.zones[zone]).find((c) => c.isCommander && c.owner === player)
      if (found) return found
    }
  }
  return null
}

export function commanderPlace(view: PlayerView, id: string): string | null {
  for (const p of Object.values(view.players)) {
    for (const [zone, label] of PLACES) if (visible(p.zones[zone]).some((c) => c.id === id)) return label
  }
  return null
}

export function frameOf(colors: string[], typeLine: string): 'W' | 'U' | 'B' | 'R' | 'G' | 'multi' | 'land' | 'colorless' {
  if (colors.length > 1) return 'multi'
  if (colors.length === 1) return colors[0] as 'W' | 'U' | 'B' | 'R' | 'G'
  return /Land|Terrain/.test(typeLine) ? 'land' : 'colorless'
}
```

Ordre de recherche : le commandement d'abord, puis les autres zones de chaque joueur (un commandant volé peut être sur le champ de bataille d'un autre).

- [x] **Étape 4 :** les tests passent.

- [x] **Étape 5 : `zones.tsx`.** Exporter `cardProps`, et `useZone(ref, key?)` : l'identifiant de dépôt devient `dropId(ref) + (key ? ':' + key : '')`, `data` reste `ref`. `onDragEnd` lit `e.over.data.current` : rien à changer dans `Table.tsx`. `ZonePile` reste en place (bandeaux et adversaire agrandi l'utilisent encore jusqu'aux tâches 2 et 3).

- [x] **Étape 6 : `PlayerPortrait.tsx`.** Reprendre `PlayerPill.tsx` (bulle, Échap, clic à côté, badges) avec :
  - portrait : `portraitCard` → `<img>` de `cardInfo(...).image`, `object-cover` avec `object-position: 50% 22%` et une légère mise à l'échelle pour cadrer l'illustration ; sinon l'initiale du nom ; 44 px (`column`) ou 32 px (`header`) ;
  - vie : `data-testid="player-life"`, `text-[52px]` (`column`) ou `text-[40px]` (`header`), `leading-none font-bold tabular-nums`, `text-dc-red-light` si `lifeLevel(life) === 'low'` ;
  - − et + : deux boutons à `aria-label` « moins : points de vie » et « plus : points de vie », Maj = ±5, désactivés si `!canAct` ;
  - cadre `border-dc-gold/70` pour le joueur actif, `opacity-50` et nom barré s'il est éliminé ;
  - bulle : `up` comme aujourd'hui ; `w-[24rem] max-w-[90vw]`, `z-[58]`.

- [x] **Étape 7 : `PileCases.tsx`.**
  - `PileCases` : grille de 4 cases (`grid-cols-4 gap-1`), chiffres `text-xl font-bold tabular-nums`, nom `text-[10px] text-dc-muted`. Bib. : `useZone({player, zone:'library'})`, `data-zone="library" data-player data-count`, mini-vignette de 24 px de haut (dos, ou `libraryTop`) ; même `Draggable` `topId(player)` et même `onDoubleClick` que `ZonePile` ; `menuGesture(onLibraryMenu)`. Cim. : `useZone({player, zone:'graveyard'}, 'case')`, bordure dorée, `onClick` → `onPile('graveyard')`. Exil : `useZone({player, zone:'exile'})`, `data-zone="exile" data-player data-count`, `onClick` → `onPile('exile')`. Main : `data-testid="hand-count"` ; prop `handZone` pour poser `data-zone="hand" data-player` (bandeau seulement).
  - `CommandBlock` : `useZone({player, zone:'command'})`, `data-zone="command" data-player data-count`, vignette 34 × 47 px avec les commandants décalés (`COMMANDER_SHIFT`), chacun en `Draggable` avec `tax={taxOf(view, id)}` ; à côté, pour chaque commandant du joueur (`isCommander && owner === player`, toutes zones visibles) : nom, `commanderPlace`, « Taxe : +N ». Sans commandant visible : la vignette vide seule, toujours cible de dépôt.
  - `GraveyardCascade` : `useZone({player, zone:'graveyard'})`, `data-zone="graveyard" data-player data-count`, `flex flex-col justify-end overflow-hidden` (les plus anciennes sortent par le haut), titre « Cimetière » + nombre ; chaque carte de `graveyardTail` en `Draggable` (`cardProps`) : nom (`cardInfo`) sur un liseré `border-2` de la couleur `frameOf`, `-mt-0.5`, ombre portée vers le haut. Clic sur le bloc (hors glisser) → `onPile('graveyard')`.
  - `GraveyardLast` : même zone et mêmes repères que la cascade, une seule ligne : « Cim. : » puis la dernière carte, ou « vide ».
  - Couleurs des liserés, en constantes dans le fichier : W `#d8d2bd`, U `#3a6ea5`, B `#3a3540`, R `#c4553b`, G `#3f7a4a`, multi `#c9a84c`, land `#8b6f4e`, colorless `#8a8a8a`.

- [x] **Étape 8 : `PlayerColumn.tsx` et `MyBoard.tsx`.**
  - `PlayerColumn` : `w-[216px] shrink-0 flex flex-col gap-1.5 rounded-xl border border-dc-border bg-dc-surface/60 p-1.5`, `data-column={player}` ; `PlayerPortrait size="column"`, badges, `PileCases`, `CommandBlock`, `GraveyardCascade` (`flex-1 min-h-0`). Sous 640 px : `max-sm:w-full max-sm:flex-row`, `CommandBlock` et cascade masqués.
  - `MyBoard` : `flex flex-col sm:flex-row gap-2` → `PlayerColumn` (`up`), puis une colonne `flex-1 min-w-0` avec le champ de bataille et la main (`h-[25%]`, toute la largeur). Les quatre `ZonePile` et le `panel` disparaissent.
  - `Table.tsx` : plus de `panelFor(me…)` dans `MyBoard` ; la vie quitte la barre du haut en mode test : retirer les props `life` et `onLife` de `TopBar` (plus utilisées) et leur affichage (`data-testid="life"`, que les scripts n'utilisent pas). En mode test, `PlayerColumn` reçoit `canAct` et `send` comme en ligne : − et + envoient l'action `life` sur moi.

- [x] **Étape 9 : contrôles navigateur.**
  - `playtest-check.mjs` : remplacer le contrôle « piles en vignettes à droite de la main » par :

```js
// Ma colonne, à gauche de mon champ de bataille et de ma main.
const column = await page.locator('[data-column]').boundingBox()
const field = await page.locator('[data-zone="battlefield"]').boundingBox()
const hand = await page.locator('[data-zone="hand"]').boundingBox()
check(column.x + column.width <= field.x && column.x + column.width <= hand.x, 'colonne à gauche du champ de bataille et de la main')
check(await page.locator('[data-column] [data-zone="library"]').count() === 1, 'la bibliothèque est dans la colonne')
```

  Après les dépôts au cimetière déjà faits par le script, ajouter : la cascade ne montre pas plus de 6 cartes (`[data-zone="graveyard"] [data-card-id]` ≤ 6) et la dernière carte déposée est la dernière de la liste.
  - Vie basse : retirer 10 points avec Maj + « moins » (deux clics), vérifier que `[data-testid="player-life"]` a la classe `text-dc-red-light`, puis remettre la vie.
  - `online-check.mjs` : les lignes 239-248 cherchent ma pastille dans `board(chloe, ANA.id)` ; elles restent valides si la ligne portrait garde `data-panel` dans le plateau d'Ana. Mettre à jour les commentaires « pastille » → « ligne portrait ».

- [x] **Ajout hors plan :** `Table.tsx` retient la zone sous le pointeur (`pointerWithin`, puis `rectIntersection` à défaut). Sans cela, un commandant lâché sur la petite zone de commandement tombait dans la cascade du cimetière voisine (contrôle « retour en zone de commandement » de `playtest-check`).
- [x] **Étape 10 :** vérifications complètes, captures (dont une avec 6 cartes ou plus au cimetière et la vie à 10 ou moins).
- [x] **Étape 11 : commit** `feat(table): colonne joueur, vie et cimetière bien visibles`.

---

## Tâche 2 : l'adversaire en Duel (#84)

**Fichiers :**
- Modifier : `components/table/OpponentBoard.tsx`, `components/table/Table.tsx`
- Modifier : `scripts/online-check.mjs` (contrôle Duel), ou un script Duel si `online-check` ne joue qu'à 3 et 4

- [x] **Étape 1 : contrôle qui échoue.** Partie à 2 (Ana contre Bastien, comptes `e2e-1` et `e2e-2`) : chez Ana, `[data-board="<Bastien>"] [data-column="<Bastien>"]` existe, son bord gauche est aligné (± 2 px) sur celui de `[data-column="<Ana>"]`, et la vie de Bastien (`player-life`) est dans cette colonne. Si `online-check` ne lance pas de Duel, ajouter une courte séquence Duel dans le même script (nouvelle table créée avec deux joueurs).
- [x] **Étape 2 :** lancer le contrôle → échec.
- [x] **Étape 3 : implémenter.** `OpponentBoard` prend `layout: 'column' | 'header'`. `column` (Duel) : `flex-row` → `PlayerColumn` (sans `up`), puis `flex-1 min-w-0 flex flex-col` avec `OpponentHand` et son `Battlefield`. `header` : inchangé à cette tâche (ligne fine actuelle). `Table.tsx` passe `layout={opponents.length === 1 ? 'column' : 'header'}`.
- [x] **Étape 4 :** vérifications complètes, captures du Duel en 1600 × 1000 et 1280 × 720 (la colonne de l'adversaire doit montrer au moins 4 noms de la cascade en 1280 × 720).
- [x] **Ajout hors plan :** en 1280 × 720, la cascade adverse ne montrait aucun nom. Pour tenir au moins 4 noms : plus de titre « Cimetière » dans la cascade (le nombre est dans la case Cim. ; « Cimetière vide » quand il n'y a rien), lignes de 18 px, bloc commandant de 32 px, écarts de la colonne à 4 px. Nouveau contrôle `online-check` : « Duel en 1280 × 720 : au moins 4 noms entiers ».
- [x] **Étape 5 : commit** `feat(table): colonne de l'adversaire en Duel`.

---

## Tâche 3 : en-têtes à 3 à 5 joueurs (#85)

**Fichiers :**
- Créer : `components/table/PlayerHeader.tsx`
- Modifier : `components/table/OpponentStrip.tsx`, `components/table/OpponentBoard.tsx`, `components/table/OpponentsArea.tsx`, `components/table/Table.tsx`
- Supprimer : `components/table/PlayerPill.tsx` (plus utilisé) ; `ZonePile` et `PILE_LABELS` de `zones.tsx` s'ils ne servent plus
- Modifier : `scripts/online-check.mjs`
- Modifier : `docs/superpowers/roadmap.md`

- [ ] **Étape 1 : contrôles qui échouent** (`online-check`, partie à 4) :
  - chez Ana, les 3 bandeaux ont le même `y` (± 2 px) : une seule rangée ;
  - `[data-strip="<Bastien>"] [data-panel="<Bastien>"] [data-testid="player-life"]` existe ;
  - `[data-strip="<Bastien>"] [data-zone="graveyard"]` contient la dernière carte qu'il a mise au cimetière ;
  - adversaire agrandi : `[data-board="<Bastien>"] [data-panel="<Bastien>"]` est au-dessus de son `[data-zone="battlefield"]`.
- [ ] **Étape 2 :** lancer `online-check` → échecs.
- [ ] **Étape 3 : `PlayerHeader`.** `PlayerPortrait size="header"`, badges sous le nom, puis une ligne `PileCases` (+ `handZone` dans un bandeau) et la petite vignette de commandement (`CommandBlock` en version mini, sans le texte), puis `GraveyardLast`. Le clic sur le nom garde `onTitleClick` (agrandir).
- [ ] **Étape 4 : bandeau et vue agrandie.**
  - `OpponentStrip` : remplacer la pastille et la ligne fine par `PlayerHeader` ; garder `data-strip`, `data-row`, `data-strip-card` et les trois rangées. Cadre `border-dc-gold/70` pour le joueur actif.
  - `OpponentBoard` `layout="header"` : `PlayerHeader`, puis `OpponentHand`, puis son `Battlefield`.
  - `OpponentsArea` : `grid-cols-2`, `grid-cols-3` ou `grid-cols-4` selon le nombre d'adversaires, une seule rangée (`grid-rows-1`).
  - Supprimer `PlayerPill` et ce qui ne sert plus dans `zones.tsx`.
- [ ] **Étape 5 :** vérifications complètes ; captures à 4 joueurs (1600 × 1000, 1280 × 720) et à 5 joueurs en 1280 × 720 (seed avec `e2e-5` si `scripts/seed-online.mjs` ne prévoit que 4 joueurs : l'ajouter dans la même PR). Si les bandeaux sont illisibles à 5 joueurs en 1280 × 720, le signaler dans #80 plutôt que de changer la mise en page.
- [ ] **Étape 6 : feuille de route.** `docs/superpowers/roadmap.md` : ajouter « Colonne joueur façon MTGO (#80) — **terminé** », et rappeler que la tablette (#81) et les fenêtres séparées (#82) suivent.
- [ ] **Étape 7 : commit** `feat(table): en-têtes des adversaires et bandeaux sur une rangée`.
