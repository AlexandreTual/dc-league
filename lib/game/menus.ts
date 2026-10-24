// Menus clic droit de la table : quelles entrées pour quelle carte, selon qui regarde.
// Pur : chaque entrée décrit des commandes (actions du moteur ou gestes d'interface), exécutées par la table.
import { cardInfo, taxOf } from './apply'
import { printedKeywordsOf } from './card-effects'
import { baseLoyalty, clampLoyalty, hasLoyalty, loyaltyStats } from './loyalty'
import { basePT, MAX_PT_MOD, NO_PT, ptStats, signed } from './pt'
import type { Messages } from '@/lib/i18n/messages'
import type { ClientAction } from './room'
import type { OrderRequest } from './selection'
import { type Catalog, type PlayerView, type PlayerZone, type Position, type TokenData, type VisibleCard, type ZoneRef } from './types'

export type MenuCommand =
  | { kind: 'action'; action: ClientAction }
  | { kind: 'ask'; question: string; fallback: number; then: (n: number) => MenuCommand[] }
  | { kind: 'openPile'; player: string; zone: 'library' | 'graveyard' | 'exile'; mode: 'look' | 'search' | 'browse'; title: string }
  /** Fenêtre « Oracle et règles » d'une carte du catalogue de son propriétaire. */
  | { kind: 'oracle'; owner: string; ref: number }
  /** Ajoute la carte (catalogue de son propriétaire) à la question de l'assistant IA, côté navigateur seulement. */
  | { kind: 'askAi'; owner: string; ref: number }
  /** Fenêtre « Capacités » d'une carte en jeu (« Donner une capacité… »). */
  | { kind: 'abilities'; id: string }
  /** Fenêtre « Effet » : force, endurance et capacités données à plusieurs permanents en jeu ; `title` : ce qui est visé. */
  | { kind: 'effect'; ids: string[]; title: string }
  /** Fenêtre « Ordre des cartes » d'un groupe sélectionné, avant de le poser sur une pile. */
  | ({ kind: 'order' } & OrderRequest)
  /** Vide la sélection de cartes. */
  | { kind: 'clearSelection' }

export type MenuEntry =
  | { kind: 'title'; label: string }
  | { kind: 'separator' }
  | { kind: 'item'; label: string; commands: MenuCommand[] }
  /**
   * `set` : valeur tapée directement (facultatif), traduite en commandes ; vide si rien ne change.
   * `signed` : valeur négative possible (force, endurance).
   */
  | { kind: 'stepper'; label: string; value: number | string; minus: MenuCommand; plus: MenuCommand; set?: (n: number) => MenuCommand[]; signed?: boolean }

export type MenuContext = {
  me: string | null
  view: PlayerView
  catalogs: Record<string, Catalog>
  /** Langue des cartes (nom affiché en titre, jeton copie). */
  lang: 'fr' | 'en'
  /** Textes de l'interface, dans sa langue. */
  t: Messages
  /** Partie terminée : plus aucune action. */
  readOnly: boolean
  /** Assistant IA disponible pour ce joueur (facultatif : absent = pas d'entrée). */
  ai?: boolean
}

const DESTINATIONS: { label: keyof Messages['menus']['zones']; zone: PlayerZone; position?: Position }[] = [
  { label: 'hand', zone: 'hand' },
  { label: 'battlefield', zone: 'battlefield' },
  { label: 'graveyard', zone: 'graveyard' },
  { label: 'exile', zone: 'exile' },
  { label: 'command', zone: 'command' },
  { label: 'libraryTop', zone: 'library', position: 'top' },
  { label: 'libraryBottom', zone: 'library', position: 'bottom' },
]

const act = (action: ClientAction): MenuCommand => ({ kind: 'action', action })
const item = (label: string, ...commands: MenuCommand[]): MenuEntry => ({ kind: 'item', label, commands })

/** Les autres joueurs en lice, dans l'ordre des places (stable, contrairement à l'ordre du tour tiré au sort). */
const others = (ctx: MenuContext, me: string) =>
  Object.keys(ctx.view.players).filter((p) => p !== me && !ctx.view.players[p].eliminated)

const MAX_COPIES = 20
const MAX_COUNTERS = 999
const clampPct = (n: number) => Math.max(0, Math.min(100, n))

/** Le jeton copie reprend la carte telle qu'elle est affichée ; un jeton copié recopie son TokenData. */
function copyData(ctx: MenuContext, card: VisibleCard): TokenData {
  if (card.token) return card.token
  const info = cardInfo(ctx.catalogs[card.owner], card, ctx.lang)
  const entry = card.ref === null ? undefined : ctx.catalogs[card.owner]?.entries.find((e) => e.ref === card.ref)
  // Valeurs imprimées seulement : une copie ne reprend ni les marqueurs ni les modifications (règle 707.2).
  const pt = basePT(ctx.catalogs[card.owner], card)
  const keywords = printedKeywordsOf(ctx.catalogs[card.owner], card)
  return {
    name: info.name, typeLine: info.typeLine, image: info.image, power: pt?.power ?? null, toughness: pt?.toughness ?? null, colors: entry?.en.colors ?? [],
    ...(keywords.length > 0 ? { keywords } : {}),
  }
}

/** « Créer un jeton copie » et « Créer des jetons copies… » : sur mon champ de bataille, à côté de l'original ou au centre. */
function copyEntries(ctx: MenuContext, card: VisibleCard, zone: ZoneRef, me: string): MenuEntry[] {
  if (card.faceDown) return []
  const token = copyData(ctx, card)
  const [x, y] = zone.player === me ? [clampPct(card.x + 4), clampPct(card.y + 4)] : [50, 50]
  const copies = (n: number): MenuCommand[] =>
    Array.from({ length: Math.max(1, Math.min(MAX_COPIES, Math.floor(n))) }, (_, k) =>
      act({ type: 'createToken', token, x: clampPct(x + 3 * k), y: clampPct(y + 3 * k), copy: true }))
  return [
    { kind: 'separator' },
    item(ctx.t.menus.copy.one, ...copies(1)),
    item(ctx.t.menus.copy.many, { kind: 'ask', question: ctx.t.menus.copy.howMany, fallback: 2, then: copies }),
  ]
}

/**
 * « Oracle et règles », puis « Ajouter à la question IA » si l'assistant est disponible, en tête du menu (sous le
 * nom de la carte) : visibles sans défiler sur tablette et téléphone, où le menu d'une carte en jeu dépasse l'écran.
 * Seulement pour une carte que le joueur voit (jamais face cachée) et qui vient d'un deck (un jeton n'a ni Oracle
 * ni règles), données de carte reçues.
 */
function oracleEntries(ctx: MenuContext, card: VisibleCard): MenuEntry[] {
  if (card.faceDown || card.token || card.ref === null) return []
  if (!ctx.catalogs[card.owner]?.entries.some((e) => e.ref === card.ref)) return []
  const entries: MenuEntry[] = [item(ctx.t.menus.oracle, { kind: 'oracle', owner: card.owner, ref: card.ref })]
  if (ctx.ai) entries.push(item(ctx.t.menus.askAi, { kind: 'askAi', owner: card.owner, ref: card.ref }))
  return [...entries, { kind: 'separator' }]
}

/**
 * Force et endurance d'une carte en jeu, modifiables par tout joueur : valeur affichée, nombre tapé = nouvelle
 * valeur (ou nouvel écart pour une carte sans force connue), puis l'écart « ce tour » (effacé à la fin du tour),
 * « Réinitialiser » quand l'une ou l'autre a été modifiée.
 */
function ptEntries(ctx: MenuContext, card: VisibleCard): MenuEntry[] {
  const id = card.id
  const stats = ptStats(ctx.catalogs[card.owner], card)
  const clamp = (n: number) => Math.max(-MAX_PT_MOD, Math.min(MAX_PT_MOD, Math.trunc(n)))
  const turn = card.ptTurn ?? NO_PT
  const turnStepper = (label: string, stat: 'power' | 'toughness'): MenuEntry => {
    const change = (n: number) => act({ type: 'ptTurn', id, power: stat === 'power' ? n : 0, toughness: stat === 'toughness' ? n : 0 })
    return {
      kind: 'stepper', label, value: signed(turn[stat]), signed: true, minus: change(-1), plus: change(1),
      set: (n) => {
        if (!Number.isFinite(n)) return []
        const delta = clamp(n) - turn[stat]
        return delta === 0 ? [] : [change(delta)]
      },
    }
  }
  const stepper = (label: string, stat: 'power' | 'toughness'): MenuEntry => {
    const shown = stats?.[stat]
    const current = shown ? (shown.value ?? shown.delta) : 0
    const change = (n: number) => act({ type: 'pt', id, power: stat === 'power' ? n : 0, toughness: stat === 'toughness' ? n : 0 })
    return {
      kind: 'stepper', label, value: shown?.text ?? '+0', signed: true, minus: change(-1), plus: change(1),
      set: (n) => {
        if (!Number.isFinite(n)) return []
        const delta = clamp(n) - current
        return delta === 0 ? [] : [change(delta)]
      },
    }
  }
  const mod = card.ptMod ?? NO_PT
  const t = ctx.t.menus.pt
  const entries = [stepper(t.power, 'power'), stepper(t.toughness, 'toughness'), turnStepper(t.powerTurn, 'power'), turnStepper(t.toughnessTurn, 'toughness')]
  const reset: MenuCommand[] = [
    ...(mod.power !== 0 || mod.toughness !== 0 ? [act({ type: 'pt', id, power: -mod.power || 0, toughness: -mod.toughness || 0 })] : []),
    ...(turn.power !== 0 || turn.toughness !== 0 ? [act({ type: 'ptTurn', id, power: -turn.power || 0, toughness: -turn.toughness || 0 })] : []),
  ]
  if (reset.length > 0) entries.push(item(t.reset, ...reset))
  return entries
}

/** Créatures en phase de mon champ de bataille (une carte face cachée est une créature 2/2), dans l'ordre de la zone. */
export function myCreatures(ctx: MenuContext): string[] {
  if (!ctx.me) return []
  return (ctx.view.players[ctx.me]?.zones.battlefield ?? []).flatMap((c) => {
    if (c.hidden || c.phasedOut) return []
    const creature = c.faceDown || cardInfo(ctx.catalogs[c.owner], c, 'en').typeLine.split(' // ')[0].split('—')[0].includes('Creature')
    return creature ? [c.id] : []
  })
}

/**
 * Loyauté d'un planeswalker en jeu, modifiable par tout joueur : valeur affichée, nombre tapé = nouvelle valeur
 * (ou nouvel écart quand la loyauté imprimée est inconnue), « Réinitialiser » quand elle a été modifiée.
 */
function loyaltyEntries(ctx: MenuContext, card: VisibleCard): MenuEntry[] {
  const catalog = ctx.catalogs[card.owner]
  if (!hasLoyalty(catalog, card)) return []
  const id = card.id
  const shown = loyaltyStats(catalog, card)
  const mod = card.loyaltyMod ?? 0
  const current = shown ? (shown.value ?? shown.delta) : 0
  const change = (delta: number) => act({ type: 'loyalty', id, delta })
  const entries: MenuEntry[] = [{
    kind: 'stepper', label: ctx.t.menus.loyalty.label, value: shown?.text ?? '+0', signed: shown?.value == null, minus: change(-1), plus: change(1),
    set: (n) => {
      if (!Number.isFinite(n)) return []
      // L'écart visé, borné comme le fera le moteur (jamais sous 0 marqueur).
      const delta = clampLoyalty(baseLoyalty(catalog, card), mod + Math.trunc(n) - current) - mod
      return delta === 0 ? [] : [change(delta)]
    },
  }]
  if (mod !== 0) entries.push(item(ctx.t.menus.loyalty.reset, change(-mod)))
  return entries
}

/**
 * Menu de l'encart d'une carte en jeu (toucher l'encart) : la loyauté d'un planeswalker qui en affiche une,
 * sinon force et endurance. Vide pour un spectateur ou une partie finie.
 */
export function statMenu(ctx: MenuContext, card: VisibleCard): MenuEntry[] {
  if (!ctx.me || ctx.readOnly) return []
  const info = cardInfo(ctx.catalogs[card.owner], card, ctx.lang)
  const entries = loyaltyStats(ctx.catalogs[card.owner], card) ? loyaltyEntries(ctx, card) : ptEntries(ctx, card)
  return [{ kind: 'title', label: info.hidden ? ctx.t.menus.faceDownCard : info.name }, ...entries]
}

function battlefieldEntries(ctx: MenuContext, card: VisibleCard, flippable: boolean, controller: boolean): MenuEntry[] {
  const id = card.id
  const counter = (label: string, kind: 'plus' | 'minus' | 'other', value: number): MenuEntry => ({
    kind: 'stepper', label, value,
    minus: act({ type: 'counter', id, kind, delta: -1 }),
    plus: act({ type: 'counter', id, kind, delta: 1 }),
    // Un écart plutôt qu'une valeur absolue : le serveur de jeu en production comprend déjà cette action.
    set: (n) => {
      if (!Number.isFinite(n)) return []
      const delta = Math.max(0, Math.min(MAX_COUNTERS, Math.floor(n))) - value
      return delta === 0 ? [] : [act({ type: 'counter', id, kind, delta })]
    },
  })
  const t = ctx.t.menus.battlefield
  const entries: MenuEntry[] = [item(card.tapped ? t.untap : t.tap, act({ type: 'tap', id })),
    item(card.phasedOut ? t.phaseIn : t.phaseOut, act({ type: 'phase', id }))]
  if (controller && flippable) entries.push(item(t.transform, act({ type: 'flip', id })))
  if (controller) {
    entries.push(item(card.faceDown ? t.faceUp : t.faceDown, act({ type: 'faceDown', id })),
      item(t.rotate, act({ type: 'rotate', id })),
      // Dans l'ordre du champ de bataille, le dessous (fin de liste) est affiché devant.
      item(t.toFront, act({ type: 'move', id, to: { player: ctx.me!, zone: 'battlefield' }, position: 'bottom' })),
      item(t.toBack, act({ type: 'move', id, to: { player: ctx.me!, zone: 'battlefield' }, position: 'top' })))
  }
  entries.push({ kind: 'separator' },
    counter('+1/+1', 'plus', card.counters.plus), counter('-1/-1', 'minus', card.counters.minus), counter(t.counter, 'other', card.counters.other),
    ...loyaltyEntries(ctx, card), ...ptEntries(ctx, card),
    item(t.abilities, { kind: 'abilities', id }))
  const creatures = controller ? myCreatures(ctx) : []
  if (creatures.length > 0) entries.push(item(t.effectAll, { kind: 'effect', ids: creatures, title: t.effectAllTitle }))
  return entries
}

/**
 * Mulligan en cours (au moins un mulligan, main pas encore gardée) : le joueur peut mettre au-dessous
 * autant de cartes de sa main qu'il le veut. Les joueurs gèrent eux-mêmes le nombre (mulligans gratuits
 * entre amis) : le jeu ne le calcule ni ne l'impose.
 */
export function inMulligan(player: { kept: boolean; mulligans: number } | undefined): boolean {
  return !!player && !player.kept && player.mulligans > 0
}

/** Entrées pour une carte visible dans une zone donnée ; vide pour un spectateur ou une partie finie. */
export function cardMenu(ctx: MenuContext, card: VisibleCard, zone: ZoneRef): MenuEntry[] {
  const me = ctx.me
  if (!me || ctx.readOnly) return []
  const id = card.id
  const info = cardInfo(ctx.catalogs[card.owner], card, ctx.lang)
  const flippable = !card.token && (info.faces?.length ?? 0) > 1
  const t = ctx.t.menus
  const title: MenuEntry = { kind: 'title', label: info.hidden ? t.faceDownCard : info.name }
  const head = [title, ...oracleEntries(ctx, card)]
  const name = (p: string) => ctx.view.players[p]?.name ?? '?'

  if (zone.player !== me) {
    // Chez un adversaire : on agit sur la carte, ou on la renvoie dans les zones de son propriétaire.
    const toOwner = (label: string, z: PlayerZone) => item(label, act({ type: 'move', id, to: { player: card.owner, zone: z } }))
    if (zone.zone === 'battlefield') {
      return [...head, ...battlefieldEntries(ctx, card, flippable, false), ...copyEntries(ctx, card, zone, me), { kind: 'separator' },
        item(t.battlefield.gainControl, act({ type: 'move', id, to: { player: me, zone: 'battlefield' } })),
        toOwner(t.theirs.hand, 'hand'), toOwner(t.theirs.graveyard, 'graveyard'), toOwner(t.theirs.exile, 'exile')]
    }
    if (zone.zone === 'graveyard' || zone.zone === 'exile') {
      return [...head, item(t.theirs.toMyBattlefield, act({ type: 'move', id, to: { player: me, zone: 'battlefield' } })),
        toOwner(t.theirs.hand, 'hand'),
        ...(zone.zone === 'graveyard' ? [toOwner(t.theirs.exile, 'exile')] : [toOwner(t.theirs.graveyard, 'graveyard')])]
    }
    return []
  }

  const entries: MenuEntry[] = [title]
  // Mulligan en cours : mettre la carte au-dessous sans Maj + glisser (impossible sur téléphone), avant tout le reste.
  if (zone.zone === 'hand' && inMulligan(ctx.view.players[me])) {
    entries.push(item(t.hand.toBottom, act({ type: 'move', id, to: { player: me, zone: 'library' }, position: 'bottom' })), { kind: 'separator' })
  }
  entries.push(...oracleEntries(ctx, card))
  if (zone.zone === 'hand') {
    entries.push(item(t.hand.revealAll, act({ type: 'reveal', ids: [id], to: 'all' })))
    for (const p of others(ctx, me)) entries.push(item(t.hand.revealTo(name(p)), act({ type: 'reveal', ids: [id], to: [p] })))
  }
  if (zone.zone === 'battlefield') {
    entries.push(...battlefieldEntries(ctx, card, flippable, true), ...copyEntries(ctx, card, zone, me))
    entries.push({ kind: 'separator' })
    for (const p of others(ctx, me)) entries.push(item(t.battlefield.giveControl(name(p)), act({ type: 'giveControl', id, to: p })))
  }
  if (card.isCommander && card.owner === me) {
    entries.push({ kind: 'stepper', label: t.commanderTax, value: `+${taxOf(ctx.view, id)}`,
      minus: act({ type: 'commanderTax', id, delta: -1 }), plus: act({ type: 'commanderTax', id, delta: 1 }) })
  }
  entries.push({ kind: 'separator' }, { kind: 'title', label: t.sendTo })
  for (const dest of DESTINATIONS) {
    if (dest.zone === zone.zone && dest.zone !== 'library') continue
    // Hors du champ de bataille, une carte va toujours chez son propriétaire.
    const player = dest.zone === 'battlefield' ? me : card.owner
    const action: ClientAction = { type: 'move', id, to: { player, zone: dest.zone } }
    if (dest.position) action.position = dest.position
    entries.push(item(t.zones[dest.label], act(action)))
  }
  return entries
}

/** Menu de la pile de bibliothèque d'un joueur. */
export function libraryMenu(ctx: MenuContext, player: string): MenuEntry[] {
  const me = ctx.me
  if (!me || ctx.readOnly) return []
  const t = ctx.t.menus.library
  const look: MenuEntry = item(t.look, {
    kind: 'ask', question: t.lookHowMany, fallback: 3,
    then: (n) => [act({ type: 'look', target: player, count: n }),
      { kind: 'openPile', player, zone: 'library', mode: 'look', title: t.lookTitle(n) }],
  })
  const search: MenuEntry = item(t.search, act({ type: 'search', target: player }),
    { kind: 'openPile', player, zone: 'library', mode: 'search', title: t.searchTitle })
  if (player !== me) return [{ kind: 'title', label: t.of(ctx.view.players[player]?.name ?? '?') }, look, search]

  const mine = ctx.view.players[me]
  return [
    { kind: 'title', label: t.mine(mine.zones.library.count) },
    item(t.draw1, act({ type: 'draw', count: 1 })),
    item(t.drawN, { kind: 'ask', question: t.drawHowMany, fallback: 2, then: (n) => [act({ type: 'draw', count: n })] }),
    item(t.shuffle, act({ type: 'shuffle' })),
    look,
    search,
    item(t.revealTop, act({ type: 'revealTop' })),
    item(mine.topRevealed ? t.hideTop : t.playRevealed, act({ type: 'toggleTopRevealed' })),
    item(mine.peekTop ? t.stopPeekTop : t.peekTop, act({ type: 'togglePeekTop' })),
  ]
}

/** Menu de ma main (clic droit sur la zone). */
export function handMenu(ctx: MenuContext): MenuEntry[] {
  const me = ctx.me
  if (!me || ctx.readOnly) return []
  const t = ctx.t.menus.hand
  return [
    { kind: 'title', label: t.title },
    item(t.revealHand, act({ type: 'reveal', ids: 'hand', to: 'all' })),
    ...others(ctx, me).map((p) => item(t.revealHandTo(ctx.view.players[p].name), act({ type: 'reveal', ids: 'hand', to: [p] }))),
  ]
}
