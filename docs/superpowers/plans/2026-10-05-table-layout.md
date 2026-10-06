# Nouvelle mise en page de la table — plan

> **Pour les agents :** exécuter tâche par tâche, une issue et une PR par tâche, dans l'ordre (chacune dépend de la précédente : mêmes fichiers de la table). Cases à cocher (`- [ ]`) pour le suivi.

**But :** donner le plus de place possible aux champs de bataille (plein écran, compteurs en pastille, piles en vignettes, bandeaux compacts, réglage de la taille des cartes), sans retirer aucune fonction.

**Architecture :** refonte par étapes dans les composants existants de `components/table/`. Le moteur (`lib/game/`) ne change pas : aucune action ni règle nouvelle. Deux modules purs nouveaux, testés avec Vitest : `lib/game/player-badges.ts` (badges de la pastille) et l'extension de `lib/table-settings.ts` (taille des cartes).

**Spec :** `docs/superpowers/specs/2026-10-05-table-layout-design.md` (issue #22).

**Pile :** Next.js 15 (edge), React, Tailwind, @dnd-kit/core, Vitest, playwright-core pour les contrôles navigateur.

## Contraintes communes

- Interface, messages et commits en français ; commit `type(portée): résumé`, PR qui ferme l'issue de la tâche (`Closes #N`).
- Les attributs `data-zone`, `data-player`, `data-board`, `data-strip`, `data-panel`, `data-card-id` et les `data-testid` existants (`player-name`, `player-life`, `hand-count`, `commander-damage-<joueur>`) restent posés : le glisser-déposer et les scripts de contrôle s'en servent.
- Écran visé : ordinateur à partir de 1280 × 720 ; tablette en paysage utilisable, sans optimisation.
- Mode test : comme aujourd'hui, pas de pastille pour moi (la vie est dans la barre du haut) ; tout le reste s'applique.
- Vérifications de chaque tâche : `npm test`, `npx tsc --noEmit`, `npx @cloudflare/next-on-pages`, puis `scripts/playtest-check.mjs` et `scripts/online-check.mjs` (voir `CLAUDE.md`). Captures jointes à la PR : Duel et 4 joueurs, en 1600 × 1000 et 1280 × 720.

---

## Tâche 1 : plein écran (#35)

**Fichiers :**
- Modifier : `components/online/OnlineTable.tsx`
- Modifier : `app/decks/[id]/test/page.tsx`
- Modifier : `scripts/playtest-check.mjs`, `scripts/online-check.mjs`

La barre du site (`components/Navbar.tsx`) est `sticky top-0 z-50`. Les deux conteneurs de table sont aujourd'hui `fixed inset-x-0 bottom-0 top-16 z-40` : ils passent au-dessus de la barre et couvrent toute la fenêtre. Les fenêtres internes de la table (`CardMenu` en `z-[60]`, `PileModal` en `z-[55]`…) restent dans le contexte d'empilement du conteneur : rien d'autre à changer.

- [ ] **Étape 1 : contrôle navigateur qui échoue.** Dans `scripts/playtest-check.mjs`, juste après le premier `waitForSelector` de la main :

```js
// Plein écran : le haut de la fenêtre appartient à la table, pas à la barre du site.
const coversSite = (p) => p.evaluate(() => !!document.elementFromPoint(window.innerWidth / 2, 8)?.closest('[data-table-root]'))
check(await coversSite(page), 'plein écran : la table couvre la barre du site')
```

Dans `scripts/online-check.mjs`, même fonction (paramètre `who.page`) et contrôle juste après « la table s'affiche chez les 3 joueurs » :

```js
for (const who of [ana, bastien, chloe]) check(await coversSite(who.page), `${who.name} : table en plein écran`)
```

- [ ] **Étape 2 :** lancer `playtest-check` (voir `CLAUDE.md`) → `ÉCHEC : plein écran : la table couvre la barre du site`.

- [ ] **Étape 3 : implémenter.** `OnlineTable.tsx` :

```tsx
/** Partie en ligne : la table alimentée par la connexion au serveur de jeu, en plein écran (au-dessus de la barre du site). */
export default function OnlineTable({ tableId }: { tableId: string }) {
  const source = useRemoteSource(tableId)
  return (
    <div className="fixed inset-0 z-[60] bg-dc-bg" data-testid="game" data-table-root>
      {source ? <Table source={source} /> : <p className="text-dc-muted text-center py-16">Connexion à la partie…</p>}
    </div>
  )
}
```

`app/decks/[id]/test/page.tsx`, dernier `return` :

```tsx
  // Le plateau couvre toute la fenêtre, barre du site comprise ; « ← nom du deck » ramène au site.
  return (
    <div className="fixed inset-0 z-[60] bg-dc-bg" data-table-root>
      <LocalTable catalog={catalog} excluded={excluded} deckName={deck.name} />
    </div>
  )
```

- [ ] **Étape 4 :** `npm test`, `npx tsc --noEmit`, build, `playtest-check` et `online-check` → tout passe.
- [ ] **Étape 5 : commit** `feat(table): plein écran pendant une partie`.

---

## Tâche 2 : pastille d'un joueur et bulle de détail (#36)

**Fichiers :**
- Créer : `lib/game/player-badges.ts`, `lib/game/player-badges.test.ts`
- Créer : `components/table/PlayerPill.tsx`
- Modifier : `components/table/PlayerPanel.tsx` (exporter `Stepper` et `opposingCommanders`)
- Modifier : `components/table/Table.tsx` (`panelFor`), `components/table/MyBoard.tsx`, `components/table/OpponentBoard.tsx`
- Modifier : `scripts/online-check.mjs`

**Interfaces produites :**
- `playerBadges(view: PlayerView, player: string, commanderName: (id: string) => string): Badge[]`
- `type Badge = { key: string; label: string; level: 'normal' | 'warn' | 'lethal' }`
- `POISON_WARN = 8`, `COMMANDER_DAMAGE_WARN = 18`
- `<PlayerPill … />` : mêmes props que `PlayerPanel` sans `compact` ; pose `data-panel={player}`, `data-testid="player-name"` (nom) et `data-testid="player-life"` (vie). Bouton « ⋯ » d'`aria-label` `Compteurs de <nom>` ; bulle `data-bubble={player}` qui contient un `PlayerPanel` complet.

- [x] **Étape 1 : tests qui échouent.** `lib/game/player-badges.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { card, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { playerBadges } from './player-badges'
import { viewFor } from './view'
import type { GameAction, GameState } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const game = () => run(setupFor('commander', 3), start(1))
const name = (id: string) => (id === card('p2', 1) ? 'Kenrith' : '?')
const badges = (s: GameState) => playerBadges(viewFor(s, 'p1'), 'p1', name)

describe('playerBadges', () => {
  it('aucun badge quand tout est à zéro', () => {
    expect(badges(game())).toEqual([])
  })

  it('poison, plus forte blessure de commandant, compteurs, monarque, initiative, dans cet ordre', () => {
    const s = apply(game(),
      { type: 'poison', actor: 'p2', target: 'p1', delta: 2 },
      { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: card('p2', 1), delta: 6 },
      { type: 'playerCounter', actor: 'p1', target: 'p1', name: 'Expérience', delta: 2 },
      { type: 'setMonarch', actor: 'p1', to: 'p1' },
      { type: 'setInitiative', actor: 'p1', to: 'p1' })
    expect(badges(s)).toEqual([
      { key: 'poison', label: '☠ 2', level: 'normal' },
      { key: 'commander', label: '⚔ Kenrith 6', level: 'normal' },
      { key: 'counter:Expérience', label: 'Expérience 2', level: 'normal' },
      { key: 'monarch', label: '👑 Monarque', level: 'normal' },
      { key: 'initiative', label: 'Initiative', level: 'normal' },
    ])
  })

  it('en alerte près du seuil, mortel au seuil', () => {
    const near = apply(game(), { type: 'poison', actor: 'p2', target: 'p1', delta: 8 },
      { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: card('p2', 1), delta: 18 })
    expect(badges(near).map((b) => b.level)).toEqual(['warn', 'warn'])
    const dead = apply(near, { type: 'poison', actor: 'p2', target: 'p1', delta: 2 },
      { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: card('p2', 1), delta: 3 })
    expect(badges(dead).map((b) => b.level)).toEqual(['lethal', 'lethal'])
  })

  it('un compteur libre revenu à zéro disparaît', () => {
    const s = apply(game(), { type: 'playerCounter', actor: 'p1', target: 'p1', name: 'Énergie', delta: 1 },
      { type: 'playerCounter', actor: 'p1', target: 'p1', name: 'Énergie', delta: -1 })
    expect(badges(s)).toEqual([])
  })
})
```

- [x] **Étape 2 :** `npx vitest run lib/game/player-badges.test.ts` → échec (module absent).

- [x] **Étape 3 : module pur.** `lib/game/player-badges.ts` :

```ts
// Badges de la pastille d'un joueur : seulement les compteurs non nuls, en alerte près des seuils.
import { COMMANDER_DAMAGE_LETHAL, POISON_LETHAL, type PlayerView } from './types'

export type Badge = { key: string; label: string; level: 'normal' | 'warn' | 'lethal' }

export const POISON_WARN = 8
export const COMMANDER_DAMAGE_WARN = 18

const level = (value: number, warn: number, lethal: number): Badge['level'] =>
  value >= lethal ? 'lethal' : value >= warn ? 'warn' : 'normal'

/** Poison, plus forte blessure de commandant, compteurs libres, monarque, initiative ; rien pour une valeur nulle. */
export function playerBadges(view: PlayerView, player: string, commanderName: (id: string) => string): Badge[] {
  const p = view.players[player]
  const out: Badge[] = []
  if (p.poison > 0) out.push({ key: 'poison', label: `☠ ${p.poison}`, level: level(p.poison, POISON_WARN, POISON_LETHAL) })
  const [worst] = Object.entries(p.commanderDamage).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  if (worst) {
    const [id, value] = worst
    out.push({ key: 'commander', label: `⚔ ${commanderName(id)} ${value}`, level: level(value, COMMANDER_DAMAGE_WARN, COMMANDER_DAMAGE_LETHAL) })
  }
  for (const [name, value] of Object.entries(p.counters)) {
    if (value > 0) out.push({ key: `counter:${name}`, label: `${name} ${value}`, level: 'normal' })
  }
  if (view.monarch === player) out.push({ key: 'monarch', label: '👑 Monarque', level: 'normal' })
  if (view.initiative === player) out.push({ key: 'initiative', label: 'Initiative', level: 'normal' })
  return out
}
```

- [x] **Étape 4 :** `npx vitest run lib/game/player-badges.test.ts` → vert.

- [x] **Étape 5 : composant.** Dans `PlayerPanel.tsx`, ajouter `export` devant `function Stepper` et `function opposingCommanders`. Créer `components/table/PlayerPill.tsx` :

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Crown, Heart, MoreHorizontal } from 'lucide-react'
import { cardInfo } from '@/lib/game/apply'
import { playerBadges } from '@/lib/game/player-badges'
import type { ClientAction } from '@/lib/game/room'
import type { Catalog, PlayerView } from '@/lib/game/types'
import type { Lang } from './GameCard'
import PlayerPanel, { opposingCommanders, Stepper } from './PlayerPanel'

const BADGE_COLORS = { normal: 'text-dc-text', warn: 'text-dc-gold', lethal: 'text-dc-red-light font-semibold' }

/**
 * Pastille d'un joueur : nom, vie ±, badges des compteurs non nuls ; « ⋯ » ouvre la bulle
 * avec tous les réglages (le panneau de joueur complet). Échap ou un clic à côté la ferme.
 */
export default function PlayerPill(props: {
  view: PlayerView
  player: string
  catalogs: Record<string, Catalog>
  lang: Lang
  host?: string
  online?: string[]
  canAct: boolean
  send: (action: ClientAction) => void
  onTitleClick?: () => void
  /** Bulle au-dessus de la pastille (ma pastille, en bas de l'écran). */
  up?: boolean
}) {
  const { up = false, ...panelProps } = props
  const { view, player, catalogs, lang, host, online, canAct, send, onTitleClick } = panelProps
  const [open, setOpen] = useState(false)
  const p = view.players[player]
  const active = view.activePlayer === player
  const commanders = opposingCommanders(view, player)
  const commanderName = (id: string) => {
    const c = commanders.find((x) => x.id === id)
    return c ? cardInfo(catalogs[c.owner], c, lang).name : 'commandant'
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative inline-flex" data-panel={player}>
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs text-dc-text whitespace-nowrap
        ${active ? 'border-dc-gold/70 bg-dc-gold/10' : 'border-dc-border bg-dc-surface/70'} ${p.eliminated ? 'opacity-50' : ''}`}>
        {online && <span className={`w-2 h-2 rounded-full ${online.includes(player) ? 'bg-dc-green-light' : 'bg-dc-muted/40'}`} title={online.includes(player) ? 'en ligne' : 'hors ligne'} />}
        <button className={`font-semibold text-sm hover:text-dc-gold ${p.eliminated ? 'line-through' : ''}`} onClick={onTitleClick} disabled={!onTitleClick} data-testid="player-name">{p.name}</button>
        {host === player && <Crown className="w-3.5 h-3.5 text-dc-gold" aria-label="hôte" />}
        {p.eliminated && <span className="text-dc-red-light">éliminé</span>}
        {!p.kept && !p.eliminated && <span className="text-dc-muted italic">choisit sa main…</span>}
        <Stepper label={<Heart className="w-3.5 h-3.5 text-dc-red-light" />} value={p.life} alert={p.life <= 0} disabled={!canAct}
          onChange={(delta) => send({ type: 'life', target: player, delta })} testId="player-life" />
        {playerBadges(view, player, commanderName).map((b) => (
          <span key={b.key} className={BADGE_COLORS[b.level]} data-badge={b.key}>{b.label}</span>
        ))}
        <button className="p-0.5 rounded hover:bg-dc-border" aria-label={`Compteurs de ${p.name}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-[57]" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 ${up ? 'bottom-full mb-1' : 'top-full mt-1'} z-[58] w-[24rem] max-w-[90vw]`} data-bubble={player}>
            <PlayerPanel {...panelProps} />
          </div>
        </>
      )}
    </div>
  )
}
```

La bulle s'ouvre sous la pastille, ou au-dessus avec `up` (ma pastille, en bas de l'écran). Le spectateur (`canAct` faux) voit la bulle en lecture seule : `PlayerPanel` désactive déjà ses boutons et masque « + compteur », Monarque et Initiative.

- [x] **Étape 6 : brancher.** `Table.tsx`, remplacer `panelFor` :

```tsx
  /** Pastille (moi, plateau agrandi) ou panneau compact (bandeau, jusqu'à la tâche 4). */
  const panelFor = (player: string, onTitleClick?: () => void, kind: 'pill' | 'pill-up' | 'compact' = 'pill') => {
    const common = { view, player, catalogs, lang, host: source.online?.host, online: source.online?.players, canAct, send, onTitleClick }
    return kind === 'compact' ? <PlayerPanel {...common} compact /> : <PlayerPill {...common} up={kind === 'pill-up'} />
  }
```

Appels : bandeau `panelFor(p, focus, 'compact')` ; plateau agrandi `panelFor(p)` ; moi `panelFor(me, undefined, 'pill-up')`.

`MyBoard.tsx` : la pastille passe à gauche de la main (les piles restent à droite du champ jusqu'à la tâche 3) :

```tsx
      <div className="h-[28%] shrink-0 flex gap-2 items-center">
        {panel && <div className="shrink-0">{panel}</div>}
        <Hand {...zoneProps} onZoneContextMenu={onHandMenu} />
      </div>
```

et dans `zones.tsx`, `Hand` : remplacer la classe `h-[28%]` par `flex-1 min-w-0 h-full`.

`OpponentBoard.tsx` : `{panel}` reste en tête, il affiche maintenant la pastille ; l'envelopper dans `<div className="shrink-0 flex items-center">{panel}</div>`.

- [x] **Étape 7 : `online-check`.** Les blessures de commandant sont dans la bulle (section « Chloé : −3 PV et 5 blessures ») :

```js
  await chloe.page.locator(`[data-strip="${ANA.id}"] [data-testid="player-name"]`).click()
  await board(chloe, ANA.id).getByRole('button', { name: `Compteurs de ${ANA.name}` }).click()
  const damage = chloe.page.locator(`[data-bubble="${ANA.id}"]`).getByTestId(`commander-damage-${CHLOE.id}`)
  for (let i = 0; i < 5; i++) await damage.locator('xpath=following-sibling::button').click()
  await chloe.page.keyboard.press('Escape')
  await ana.page.waitForFunction((id) => document.querySelector(`[data-board="${id}"] [data-panel="${id}"] [data-testid="player-life"]`)?.textContent === '32', ANA.id)
  await ana.page.waitForFunction((id) => document.querySelector(`[data-board="${id}"] [data-badge="commander"]`)?.textContent?.endsWith(' 5'), ANA.id)
  check(true, 'Ana voit le badge « ⚔ … 5 » et 32 PV (40 − 3 − 5 : les blessures retirent aussi des PV)')
```

Ajouter ensuite : `check(await chloe.page.locator('[data-bubble]').count() === 0, 'Échap ferme la bulle')`.

- [x] **Étape 8 :** vérifications complètes (voir Contraintes communes) ; captures.
- [x] **Étape 9 : commit** `feat(table): pastille des joueurs et bulle des compteurs`.

---

## Tâche 3 : piles en vignettes et hauteurs du Duel (#37)

**Fichiers :**
- Modifier : `components/table/zones.tsx` (`ZonePile`)
- Modifier : `components/table/MyBoard.tsx`, `components/table/OpponentBoard.tsx`, `components/table/Table.tsx` (hauteur de la zone des adversaires)
- Modifier : `scripts/playtest-check.mjs`

**Interfaces :**
- `ZonePile` : la prop `compact?: boolean` est remplacée par `size: 'tile' | 'mini'` ; la pile pose `data-count={count}` (les scripts lisent le nombre de cartes ici, plus dans le texte).

- [x] **Étape 1 : contrôles qui échouent.** `playtest-check.mjs` : remplacer les deux lectures `Number((await page.locator('[data-zone="library"]').innerText()).match(/\((\d+)\)/)[1])` (et la fonction `libraryCount`) par :

```js
const libraryCount = async () => Number(await page.locator('[data-zone="library"]').getAttribute('data-count'))
```

puis, après le plein écran :

```js
// Mes piles en vignettes, à droite de la main et à sa hauteur.
const handBox = await page.locator('[data-zone="hand"]').boundingBox()
const libraryBox = await page.locator('[data-zone="library"]').boundingBox()
check(libraryBox.x >= handBox.x + handBox.width && libraryBox.y >= handBox.y - 2 && libraryBox.y + libraryBox.height <= handBox.y + handBox.height + 2,
  'piles en vignettes à droite de la main')
```

- [x] **Étape 2 :** `playtest-check` → `ÉCHEC : piles en vignettes à droite de la main`.

- [x] **Étape 3 : `ZonePile`.** Libellés courts et mise en page en vignette (le reste du composant — bibliothèque, carte du dessus connue, glisser, double-clic, clic droit — ne change pas) :

```tsx
const PILE_LABELS: Record<'command' | 'library' | 'graveyard' | 'exile', string> = {
  command: 'Cmd', library: 'Bib.', graveyard: 'Cim.', exile: 'Exil',
}
```

Conteneur de la pile :

```tsx
    <div
      ref={setNodeRef}
      data-zone={zone}
      data-player={player}
      data-count={count}
      className={`relative h-full flex flex-col items-center gap-0.5 rounded-lg ${highlight}`}
      onClick={props.onPileClick}
      onContextMenu={…inchangé…}
    >
      <div className={`flex-1 min-h-0 aspect-[63/88] flex ${props.size === 'mini' ? 'h-10' : ''}`}>
        …vide (cadre en pointillé), bibliothèque, cartes : inchangés ;
        commandement : chaque carte après la première reçoit style={{ marginLeft: '-60%' }}…
      </div>
      <span className="text-[10px] leading-none text-dc-muted whitespace-nowrap">{PILE_LABELS[zone]} {count}</span>
    </div>
```

Le texte « Taxe +N » reste dessiné par `GameCard` sur la carte du commandant.

- [x] **Étape 4 : `MyBoard`.**

```tsx
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-2" data-board={zoneProps.player}>
      <Battlefield {...zoneProps} />
      <div className="h-[25%] min-h-[96px] shrink-0 flex gap-2 items-stretch">
        {panel && <div className="shrink-0 self-center">{panel}</div>}
        <Hand {...zoneProps} onZoneContextMenu={onHandMenu} />
        <div className="shrink-0 flex gap-1.5 py-1">
          <ZonePile zone="command" size="tile" me={me} {...zoneProps} />
          <ZonePile zone="library" size="tile" me={me} {...zoneProps} onPileContextMenu={onLibraryMenu} />
          <ZonePile zone="graveyard" size="tile" me={me} {...zoneProps} onPileClick={() => onPile('graveyard', 'Cimetière')} />
          <ZonePile zone="exile" size="tile" me={me} {...zoneProps} onPileClick={() => onPile('exile', 'Exil')} />
        </div>
      </div>
    </div>
```

- [x] **Étape 5 : `OpponentBoard`.** Une ligne fine au-dessus de son champ :

```tsx
    <div className="h-full min-h-0 flex flex-col gap-1.5" data-board={zoneProps.player}>
      <div className="h-12 shrink-0 flex items-center gap-2">
        <div className="shrink-0">{panel}</div>
        <OpponentHand {...zoneProps} />
        <div className="ml-auto h-full flex gap-1">
          <ZonePile zone="command" size="mini" me={me} {...zoneProps} />
          <ZonePile zone="library" size="mini" me={me} {...zoneProps} onPileContextMenu={onLibraryMenu} />
          <ZonePile zone="graveyard" size="mini" me={me} {...zoneProps} onPileClick={() => onPile('graveyard', `Cimetière de ${name}`)} />
          <ZonePile zone="exile" size="mini" me={me} {...zoneProps} onPileClick={() => onPile('exile', `Exil de ${name}`)} />
        </div>
      </div>
      <Battlefield {...zoneProps} label={`Champ de bataille de ${name}`} />
    </div>
```

- [x] **Étape 6 : hauteurs du Duel.** `Table.tsx`, zone des adversaires : `${me ? 'h-[42%] shrink-0' : 'flex-1'}` devient `${me ? `${opponents.length === 1 ? 'h-[40%]' : 'h-[42%]'} shrink-0` : 'flex-1'}`.

- [x] **Étape 7 :** vérifications complètes ; contrôler dans `online-check` que les glisser-déposer vers le cimetière d'Ana et depuis son plateau agrandi passent toujours ; captures.
- [x] **Étape 8 : commit** `feat(table): piles en vignettes à côté de la main`.

---

## Tâche 4 : bandeaux d'adversaires compacts (#38)

**Fichiers :**
- Modifier : `components/table/OpponentStrip.tsx`
- Modifier : `components/table/Table.tsx` (pastille dans les bandeaux, hauteur multijoueur)
- Modifier : `components/table/PlayerPanel.tsx` (retirer le mode `compact`, devenu inutile)
- Modifier : `scripts/online-check.mjs` si un sélecteur bouge

- [x] **Étape 1 : contrôle qui échoue.** `online-check.mjs`, après « Ana voit ses 2 adversaires en bandeaux » :

```js
// Bandeau compact : la pastille et une ligne fine, puis les rangées sur toute la largeur du bandeau.
const strip = await ana.page.locator(`[data-strip="${BASTIEN.id}"]`).boundingBox()
const rows = await ana.page.locator(`[data-strip="${BASTIEN.id}"] [data-zone="battlefield"]`).boundingBox()
check(rows.width >= strip.width - 24, 'bandeau : rangées sur toute la largeur')
```

- [x] **Étape 2 :** `online-check` → échec (aujourd'hui une colonne de 112 px est à gauche des rangées).

- [x] **Étape 3 : `OpponentStrip`.** Garder `mini` et `pile` ; remplacer le `return` par :

```tsx
  return (
    <div className="h-full min-h-0 flex flex-col gap-1 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/30 p-1.5" data-strip={player}>
      <div className="shrink-0 flex items-center gap-3 text-[11px] text-dc-muted overflow-hidden">
        {panel}
        <span data-zone="hand" data-player={player}>Main : <span className="text-dc-text" data-testid="hand-count">{zones.hand.length}</span></span>
        <span data-zone="library" data-player={player} className="flex items-center gap-1 cursor-context-menu" onContextMenu={(e) => { e.preventDefault(); onLibraryMenu(e) }}>
          {top && (
            <span className="h-6 shrink-0" onMouseEnter={() => handlers.onHover(top.id)} onMouseLeave={() => handlers.onHover(null)}>
              <GameCard card={top} catalog={catalogs[top.owner]} lang={lang} className="h-full" />
            </span>
          )}
          Bib. <span className="text-dc-text">{zones.library.count}</span>
        </span>
        {visible(zones.command).length > 0 && (
          <span className="flex items-center gap-1" data-zone="command" data-player={player}>
            {visible(zones.command).map((c) => (
              <span key={c.id} className="h-6" title={cardInfo(catalogs[c.owner], c, lang).name}
                onContextMenu={(e) => { e.preventDefault(); handlers.onContextMenu(c.id, { player, zone: 'command' }, e) }}
                onMouseEnter={() => handlers.onHover(c.id)} onMouseLeave={() => handlers.onHover(null)}>
                <GameCard card={c} catalog={catalogs[c.owner]} lang={lang} className="h-full" />
              </span>
            ))}
          </span>
        )}
        {pile('graveyard', 'Cim.')}
        {pile('exile', 'Exil')}
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-[2fr_1fr_1fr] gap-2 overflow-y-auto" data-zone="battlefield" data-player={player}>
        …les trois rangées, inchangées…
      </div>
    </div>
  )
```

Le titre passé à `onPile` reste « Cimetière » / « Exil » (titre de la fenêtre) : `pile` reçoit le libellé court pour l'affichage et garde le titre long pour `onPile`.

- [x] **Étape 4 : `Table.tsx`.** Bandeau : `panelFor(p, focus)` (pastille, plus `'compact'`). Hauteur multijoueur : `h-[42%]` devient `h-[38%]` (le Duel garde `h-[40%]`). `PlayerPanel.tsx` : retirer la prop `compact` et ses deux branches ; le type `'compact'` de `panelFor` disparaît.

- [x] **Étape 5 :** vérifications complètes ; captures à 4 joueurs.
- [x] **Étape 6 : commit** `feat(table): bandeaux d'adversaires compacts`.

---

## Tâche 5 : réglage « Taille des cartes » (#39)

**Fichiers :**
- Modifier : `lib/table-settings.ts`, `lib/table-settings.test.ts`
- Modifier : `components/table/TableSettings.tsx`, `components/table/zones.tsx` (`Battlefield`)
- Modifier : `scripts/playtest-check.mjs`

**Interfaces :**
- `TableSettings` gagne `cardScale: number` ; `CARD_SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5]` ; `cardSize(scale: number): { width: string; minWidth: string }`.

- [ ] **Étape 1 : tests qui échouent.** `lib/table-settings.test.ts` : partout où un objet de réglages est écrit, ajouter `cardScale: 1` (ex. `battlefieldStyle({ grid: false, background: null, cardScale: 1 })`) et `DEFAULT_TABLE_SETTINGS` attendu `{ grid: true, background: null, cardScale: 1 }`. Ajouter :

```ts
describe('taille des cartes', () => {
  it('réglage absent (sauvegarde d’avant) : 100 %, le reste est gardé', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: '#1e3a2f' }))).toEqual({ grid: false, background: '#1e3a2f', cardScale: 1 })
  })

  it('relit une taille proposée, ignore une valeur hors liste', () => {
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1.3 })).cardScale).toBe(1.3)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 7 })).cardScale).toBe(1)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: '1.3' })).cardScale).toBe(1)
  })

  it('cardSize : 7 % de la largeur et au moins 72 px à 100 %, multipliés par le réglage', () => {
    expect(cardSize(1)).toEqual({ width: '7%', minWidth: '72px' })
    expect(cardSize(1.5)).toEqual({ width: '10.5%', minWidth: '108px' })
    expect(cardSize(0.8)).toEqual({ width: '5.6%', minWidth: '58px' })
  })
})
```

- [ ] **Étape 2 :** `npx vitest run lib/table-settings.test.ts` → échec.

- [ ] **Étape 3 : implémenter** dans `lib/table-settings.ts` :

```ts
export type TableSettings = {
  /** Quadrillage discret sur les champs de bataille. */
  grid: boolean
  /** Couleur du fond des champs de bataille (#rrggbb), ou null pour le fond par défaut. */
  background: string | null
  /** Taille des cartes des grands champs de bataille (1 = taille automatique). */
  cardScale: number
}

export const CARD_SCALES = [0.8, 0.9, 1, 1.15, 1.3, 1.5]
export const DEFAULT_TABLE_SETTINGS: TableSettings = { grid: true, background: null, cardScale: 1 }
```

Dans `parseTableSettings`, après les contrôles existants :

```ts
    const cardScale = CARD_SCALES.includes(data.cardScale) ? data.cardScale : 1
    return { grid: data.grid, background: data.background?.toLowerCase() ?? null, cardScale }
```

Et :

```ts
/** Largeur d'une carte sur un grand champ de bataille : 7 % de sa largeur, au moins 72 px, multipliés par le réglage. */
export function cardSize(scale: number): { width: string; minWidth: string } {
  return { width: `${Math.round(7 * scale * 10) / 10}%`, minWidth: `${Math.round(72 * scale)}px` }
}
```

- [ ] **Étape 4 :** `npx vitest run lib/table-settings.test.ts` → vert.

- [ ] **Étape 5 : interface.** `Battlefield` (`zones.tsx`) : retirer `w-[7%] min-w-[72px]` de la classe de la carte et ajouter `...cardSize((props.settings ?? DEFAULT_TABLE_SETTINGS).cardScale)` à son `style`. `TableSettings.tsx`, avant « Mémorisé sur cet appareil » :

```tsx
        <label className="flex items-center gap-2 text-sm text-dc-text">
          Taille des cartes
          <select className="ml-auto bg-dc-bg border border-dc-border rounded px-2 py-1 text-sm" value={settings.cardScale}
            onChange={(e) => onChange({ ...settings, cardScale: Number(e.target.value) })} aria-label="Taille des cartes">
            {CARD_SCALES.map((s) => <option key={s} value={s}>{Math.round(s * 100)} %</option>)}
          </select>
        </label>
```

- [ ] **Étape 6 : `playtest-check`.** Dans la section « Réglages » :

```js
  const fieldCard = page.locator('[data-zone="battlefield"] [data-card-id]').first()
  const widthBefore = (await fieldCard.boundingBox()).width
  await page.getByRole('button', { name: 'Réglages' }).click()
  await page.getByLabel('Taille des cartes').selectOption('1.5')
  const widthAfter = (await fieldCard.boundingBox()).width
  check(Math.abs(widthAfter / widthBefore - 1.5) < 0.05, `taille des cartes 150 % (${Math.round(widthBefore)} → ${Math.round(widthAfter)} px)`)
  await page.getByLabel('Taille des cartes').selectOption('1')
  await page.getByRole('button', { name: 'Fermer les réglages' }).click()
```

- [ ] **Étape 7 :** vérifications complètes ; captures à 100 % et 150 %.
- [ ] **Étape 8 : commit** `feat(table): réglage de la taille des cartes`. Mettre à jour `docs/superpowers/roadmap.md` (chantier « mise en page de la table » terminé) et fermer l'issue #22 dans cette PR.
