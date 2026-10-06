// Menus clic droit de la table : quelles entrées pour quelle carte, selon qui regarde.
// Pur : chaque entrée décrit des commandes (actions du moteur ou gestes d'interface), exécutées par la table.
import { cardInfo, taxOf } from './apply'
import type { ClientAction } from './room'
import { OPENING_HAND, type Catalog, type PlayerView, type PlayerZone, type Position, type TokenData, type VisibleCard, type ZoneRef } from './types'

export type MenuCommand =
  | { kind: 'action'; action: ClientAction }
  | { kind: 'ask'; question: string; fallback: number; then: (n: number) => MenuCommand[] }
  | { kind: 'openPile'; player: string; zone: 'library' | 'graveyard' | 'exile'; mode: 'look' | 'search' | 'browse'; title: string }

export type MenuEntry =
  | { kind: 'title'; label: string }
  | { kind: 'separator' }
  | { kind: 'item'; label: string; commands: MenuCommand[] }
  | { kind: 'stepper'; label: string; value: number | string; minus: MenuCommand; plus: MenuCommand }

export type MenuContext = {
  me: string | null
  view: PlayerView
  catalogs: Record<string, Catalog>
  lang: 'fr' | 'en'
  /** Partie terminée : plus aucune action. */
  readOnly: boolean
}

const DESTINATIONS: { label: string; zone: PlayerZone; position?: Position }[] = [
  { label: 'Main', zone: 'hand' },
  { label: 'Champ de bataille', zone: 'battlefield' },
  { label: 'Cimetière', zone: 'graveyard' },
  { label: 'Exil', zone: 'exile' },
  { label: 'Zone de commandement', zone: 'command' },
  { label: 'Dessus de la bibliothèque', zone: 'library', position: 'top' },
  { label: 'Dessous de la bibliothèque', zone: 'library', position: 'bottom' },
]

const act = (action: ClientAction): MenuCommand => ({ kind: 'action', action })
const item = (label: string, ...commands: MenuCommand[]): MenuEntry => ({ kind: 'item', label, commands })

/** Les autres joueurs en lice, dans l'ordre des places (stable, contrairement à l'ordre du tour tiré au sort). */
const others = (ctx: MenuContext, me: string) =>
  Object.keys(ctx.view.players).filter((p) => p !== me && !ctx.view.players[p].eliminated)

const MAX_COPIES = 20
const clampPct = (n: number) => Math.max(0, Math.min(100, n))

/** Le jeton copie reprend la carte telle qu'elle est affichée ; un jeton copié recopie son TokenData. */
function copyData(ctx: MenuContext, card: VisibleCard): TokenData {
  if (card.token) return card.token
  const info = cardInfo(ctx.catalogs[card.owner], card, ctx.lang)
  const entry = card.ref === null ? undefined : ctx.catalogs[card.owner]?.entries.find((e) => e.ref === card.ref)
  return { name: info.name, typeLine: info.typeLine, image: info.image, power: null, toughness: null, colors: entry?.en.colors ?? [] }
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
    item('Créer un jeton copie', ...copies(1)),
    item('Créer des jetons copies…', { kind: 'ask', question: 'Combien de jetons ?', fallback: 2, then: copies }),
  ]
}

function battlefieldEntries(card: VisibleCard, flippable: boolean, controller: boolean): MenuEntry[] {
  const id = card.id
  const counter = (label: string, kind: 'plus' | 'minus' | 'other', value: number): MenuEntry => ({
    kind: 'stepper', label, value,
    minus: act({ type: 'counter', id, kind, delta: -1 }),
    plus: act({ type: 'counter', id, kind, delta: 1 }),
  })
  const entries: MenuEntry[] = [item(card.tapped ? 'Dégager' : 'Engager', act({ type: 'tap', id }))]
  if (controller && flippable) entries.push(item('Retourner', act({ type: 'flip', id })))
  if (controller) entries.push(item(card.faceDown ? 'Face visible' : 'Face cachée', act({ type: 'faceDown', id })))
  entries.push({ kind: 'separator' },
    counter('+1/+1', 'plus', card.counters.plus), counter('-1/-1', 'minus', card.counters.minus), counter('Compteur', 'other', card.counters.other))
  return entries
}

/**
 * Cartes encore à mettre au-dessous après un mulligan, main pas encore gardée : la main doit
 * redescendre à 7 moins une carte par mulligan au-delà du premier (gratuit). Le moteur ne compte pas
 * les cartes déjà mises dessous : on part de la taille de la main, bornée par la dette du mulligan
 * (une carte piochée avant de garder, en ligne, ne crée pas de dette).
 */
export function cardsToBottom(view: PlayerView, player: string): number {
  const p = view.players[player]
  if (!p || p.kept) return 0
  const owed = Math.max(0, p.mulligans - 1)
  return Math.min(owed, Math.max(0, p.zones.hand.length - (OPENING_HAND - owed)))
}

/** Entrées pour une carte visible dans une zone donnée ; vide pour un spectateur ou une partie finie. */
export function cardMenu(ctx: MenuContext, card: VisibleCard, zone: ZoneRef): MenuEntry[] {
  const me = ctx.me
  if (!me || ctx.readOnly) return []
  const id = card.id
  const info = cardInfo(ctx.catalogs[card.owner], card, ctx.lang)
  const flippable = !card.token && (info.faces?.length ?? 0) > 1
  const title: MenuEntry = { kind: 'title', label: info.hidden ? 'Carte face cachée' : info.name }
  const name = (p: string) => ctx.view.players[p]?.name ?? '?'

  if (zone.player !== me) {
    // Chez un adversaire : on agit sur la carte, ou on la renvoie dans les zones de son propriétaire.
    const toOwner = (label: string, z: PlayerZone) => item(label, act({ type: 'move', id, to: { player: card.owner, zone: z } }))
    if (zone.zone === 'battlefield') {
      return [title, ...battlefieldEntries(card, flippable, false), ...copyEntries(ctx, card, zone, me), { kind: 'separator' },
        item('Prendre le contrôle', act({ type: 'move', id, to: { player: me, zone: 'battlefield' } })),
        toOwner('Dans sa main', 'hand'), toOwner('Dans son cimetière', 'graveyard'), toOwner('Dans son exil', 'exile')]
    }
    if (zone.zone === 'graveyard' || zone.zone === 'exile') {
      return [title, item('Sur mon champ de bataille', act({ type: 'move', id, to: { player: me, zone: 'battlefield' } })),
        toOwner('Dans sa main', 'hand'),
        ...(zone.zone === 'graveyard' ? [toOwner('Dans son exil', 'exile')] : [toOwner('Dans son cimetière', 'graveyard')])]
    }
    return []
  }

  const entries: MenuEntry[] = [title]
  if (zone.zone === 'hand') {
    // Mulligan à payer : mettre la carte au-dessous sans Maj + glisser (impossible sur téléphone).
    if (cardsToBottom(ctx.view, me) > 0) {
      entries.push(item('Mettre au-dessous', act({ type: 'move', id, to: { player: me, zone: 'library' }, position: 'bottom' })), { kind: 'separator' })
    }
    entries.push(item('Révéler à tous', act({ type: 'reveal', ids: [id], to: 'all' })))
    for (const p of others(ctx, me)) entries.push(item(`Révéler à ${name(p)}`, act({ type: 'reveal', ids: [id], to: [p] })))
  }
  if (zone.zone === 'battlefield') {
    entries.push(...battlefieldEntries(card, flippable, true), ...copyEntries(ctx, card, zone, me))
    entries.push({ kind: 'separator' })
    for (const p of others(ctx, me)) entries.push(item(`Donner le contrôle à ${name(p)}`, act({ type: 'giveControl', id, to: p })))
  }
  if (card.isCommander && card.owner === me) {
    entries.push({ kind: 'stepper', label: 'Taxe', value: `+${taxOf(ctx.view, id)}`,
      minus: act({ type: 'commanderTax', id, delta: -1 }), plus: act({ type: 'commanderTax', id, delta: 1 }) })
  }
  entries.push({ kind: 'separator' }, { kind: 'title', label: 'Envoyer vers' })
  for (const dest of DESTINATIONS) {
    if (dest.zone === zone.zone && dest.zone !== 'library') continue
    // Hors du champ de bataille, une carte va toujours chez son propriétaire.
    const player = dest.zone === 'battlefield' ? me : card.owner
    const action: ClientAction = { type: 'move', id, to: { player, zone: dest.zone } }
    if (dest.position) action.position = dest.position
    entries.push(item(dest.label, act(action)))
  }
  return entries
}

/** Menu de la pile de bibliothèque d'un joueur. */
export function libraryMenu(ctx: MenuContext, player: string): MenuEntry[] {
  const me = ctx.me
  if (!me || ctx.readOnly) return []
  const look: MenuEntry = item('Regarder les X du dessus…', {
    kind: 'ask', question: 'Combien de cartes regarder ?', fallback: 3,
    then: (n) => [act({ type: 'look', target: player, count: n }),
      { kind: 'openPile', player, zone: 'library', mode: 'look', title: `Les ${n} cartes du dessus` }],
  })
  const search: MenuEntry = item('Chercher une carte…', act({ type: 'search', target: player }),
    { kind: 'openPile', player, zone: 'library', mode: 'search', title: 'Chercher dans la bibliothèque' })
  if (player !== me) return [{ kind: 'title', label: `Bibliothèque de ${ctx.view.players[player]?.name ?? '?'}` }, look, search]

  const mine = ctx.view.players[me]
  return [
    { kind: 'title', label: `Bibliothèque (${mine.zones.library.count})` },
    item('Piocher 1', act({ type: 'draw', count: 1 })),
    item('Piocher N…', { kind: 'ask', question: 'Combien de cartes piocher ?', fallback: 2, then: (n) => [act({ type: 'draw', count: n })] }),
    item('Mélanger', act({ type: 'shuffle' })),
    look,
    search,
    item('Révéler la carte du dessus', act({ type: 'revealTop' })),
    item(mine.topRevealed ? 'Cacher la carte du dessus' : 'Jouer avec la carte du dessus révélée', act({ type: 'toggleTopRevealed' })),
    item(mine.peekTop ? 'Ne plus voir la carte du dessus' : 'Voir la carte du dessus (pour moi seul)', act({ type: 'togglePeekTop' })),
  ]
}

/** Menu de ma main (clic droit sur la zone). */
export function handMenu(ctx: MenuContext): MenuEntry[] {
  if (!ctx.me || ctx.readOnly) return []
  return [{ kind: 'title', label: 'Ma main' }, item('Révéler ma main', act({ type: 'reveal', ids: 'hand', to: 'all' }))]
}
