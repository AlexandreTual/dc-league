import { rollDice, rollText } from './dice'
import { baseLoyalty, clampLoyalty, loyaltyStats } from './loyalty'
import { abilitiesLog, abilityText, addAbilities, join, nextAbilities, type Abilities } from './abilities'
import { printedKeywordsOf } from './card-effects'
import { DUNGEONS, firstRoom, roomOf, ventureStep } from './dungeons'
import { MAX_PT_MOD, NO_PT, ptLog, ptStats, ptText } from './pt'
import { shuffle } from './random'
import { canApply, controllerOf, zoneOf } from './rules'
import {
  COMMANDER_TAX_STEP,
  EVERYONE,
  FIRST_PLAYER_DRAWS_FROM,
  HIDDEN_ZONES,
  NO_MANA,
  OPENING_HAND,
  type CardFace,
  type CardInstance,
  type Catalog,
  type GameAction,
  type GameState,
  type LogCard,
  type LogKey,
  type LogMessage,
  type LogParam,
  type PlayerState,
  type PlayerZone,
  type Position,
  type Seed,
  type ZoneRef,
} from './types'

const ZONE_LABELS: Record<PlayerZone, string> = {
  library: 'bibliothèque',
  hand: 'main',
  battlefield: 'champ de bataille',
  graveyard: 'cimetière',
  exile: 'exil',
  command: 'zone de commandement',
}

const NO_COUNTERS = { plus: 0, minus: 0, other: 0 }
const clampPct = (v: number) => Math.min(100, Math.max(0, v))
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

// ── Lecture ───────────────────────────────────────────────────────────────────

function entryOf(state: GameState, card: CardInstance) {
  return card.ref === null ? undefined : state.catalogs[card.owner]?.entries.find((e) => e.ref === card.ref)
}

/** Nom pour le journal : français s'il existe, sinon anglais. */
export function cardName(state: GameState, id: string): string {
  const card = state.cards[id]
  if (!card) return 'une carte'
  if (card.token) return card.token.name
  const entry = entryOf(state, card)
  return entry?.fr?.printed_name ?? entry?.en.name ?? 'une carte'
}

export function isLand(state: GameState, id: string): boolean {
  const card = state.cards[id]
  if (!card) return false
  const typeLine = card.token?.typeLine ?? entryOf(state, card)?.en.type_line ?? ''
  return typeLine.split(' // ')[0].includes('Land')
}

export function taxOf(state: Pick<GameState, 'commanderCasts'>, id: string): number {
  return COMMANDER_TAX_STEP * (state.commanderCasts[id] ?? 0)
}

/** Mention affichée sur un jeton, pour le distinguer d'une vraie carte. */
export function tokenBadge(card: Pick<CardInstance, 'token'>): 'Jeton' | 'Copie' | null {
  if (!card.token) return null
  return card.token.copy ? 'Copie' : 'Jeton'
}

/** `imageLarge` : image 672 px pour les grands affichages (aperçu), null si inconnue. */
export type CardInfo = { name: string; image: string | null; imageLarge: string | null; typeLine: string; faces: CardFace[] | null; hidden: boolean }

const UNKNOWN: CardInfo = { name: 'une carte', image: null, imageLarge: null, typeLine: '', faces: null, hidden: true }

/** Nom, image et type affichés d'une carte, à partir du catalogue de son propriétaire. */
export function cardInfo(
  catalog: Catalog | undefined,
  card: Pick<CardInstance, 'ref' | 'token' | 'flipped' | 'faceDown'>,
  lang: 'fr' | 'en',
): CardInfo {
  if (card.token) return { name: card.token.name, image: card.token.image, imageLarge: null, typeLine: card.token.typeLine, faces: null, hidden: false }
  const entry = card.ref === null ? undefined : catalog?.entries.find((e) => e.ref === card.ref)
  const shown = (lang === 'fr' ? entry?.fr : null) ?? entry?.en
  if (!shown) return UNKNOWN
  const faces = shown.faces
  const face = card.flipped && faces && faces.length > 1 ? faces[1] : null
  return {
    name: face ? (face.printed_name ?? face.name) : (shown.printed_name ?? shown.name),
    image: face?.image_normal ?? shown.image_normal,
    // Facultative : un catalogue venu d'un serveur de jeu plus ancien n'a pas l'image large.
    imageLarge: (face ? face.image_large : shown.image_large) ?? null,
    typeLine: face?.type_line ?? shown.type_line,
    faces,
    hidden: card.faceDown,
  }
}

export function cardData(state: GameState, id: string, lang: 'fr' | 'en'): CardInfo {
  const card = state.cards[id]
  return card ? cardInfo(state.catalogs[card.owner], card, lang) : UNKNOWN
}

// ── Écriture (toujours sur des copies) ────────────────────────────────────────

/** Ligne du journal : `text` en français (navigateurs plus anciens) et `msg`, la même ligne à traduire. */
function log(state: GameState, actor: string | null, text: string, msg: LogMessage, visibleTo: string[] | 'all' = 'all'): GameState {
  return { ...state, log: [...state.log, { turn: state.turn, actor, text, visibleTo, msg }] }
}

/** Ligne structurée compacte : valeurs absentes retirées, pas de `params` vide. */
function msgOf(key: LogKey, params: Record<string, LogParam | undefined> = {}): LogMessage {
  const kept = Object.entries(params).filter((e): e is [string, LogParam] => e[1] !== undefined)
  return kept.length > 0 ? { key, params: Object.fromEntries(kept) } : { key }
}

/** Carte nommée par une ligne : à ne donner que là où `text` la nomme déjà (même visibilité). */
function logCard(state: GameState, id: string): LogCard {
  const card = state.cards[id]
  if (!card) return { owner: '', ref: null }
  return card.token ? { owner: card.owner, ref: null, token: card.token.name } : { owner: card.owner, ref: card.ref }
}
const cardParam = (state: GameState, id: string): LogParam => ({ card: logCard(state, id) })
/** Carte nommée sauf face cachée (paramètre absent : la phrase dit « une carte face cachée »). */
const shownParam = (state: GameState, id: string): LogParam | undefined => (state.cards[id]?.faceDown ? undefined : cardParam(state, id))
const zoneParam = (actor: string, ref: ZoneRef): LogParam => (ref.player === actor ? { zone: ref.zone } : { zone: ref.zone, of: ref.player })
/** Bibliothèque visée : celle d'un autre joueur, ou absente pour la sienne. */
const otherParam = (actor: string, target: string): LogParam | undefined => (target === actor ? undefined : { player: target })
const flag = (on: boolean): 1 | undefined => (on ? 1 : undefined)

/** Force et endurance de la ligne `pt`, comme `ptLog` : affichées, puis modifications pour toujours et du tour. */
function ptParams(catalog: Catalog | undefined, card: CardInstance): { pt?: string; mod?: string; turn?: string } {
  const stats = ptStats(catalog, card)
  if (!stats) return {}
  const pt = `${stats.power.text}/${stats.toughness.text}`
  if (!stats.base) return { pt }
  const text = (mod: CardInstance['ptMod']) => (!mod || (mod.power === 0 && mod.toughness === 0) ? undefined : ptText(mod))
  return { pt, mod: text(card.ptMod), turn: text(card.ptTurn) }
}

/** Changement de capacités de la ligne `abilities`, comme `abilitiesLog` : données, précisions changées, retirées, rendues. */
function abilitiesParams(before: Abilities, after: Abilities): Record<string, LogParam | undefined> {
  const had = new Map((before.gained ?? []).map((g) => [g.keyword, g]))
  const has = new Set((after.gained ?? []).map((g) => g.keyword))
  const wasLost = new Set(before.lost ?? [])
  const isLost = new Set(after.lost ?? [])
  const added = (after.gained ?? []).filter((g) => !had.has(g.keyword))
  const changed = (after.gained ?? []).filter((g) => had.has(g.keyword) && had.get(g.keyword)!.param !== g.param && g.param !== undefined)
  const removed = [...[...had.keys()].filter((k) => !has.has(k)), ...[...isLost].filter((k) => !wasLost.has(k))]
  const restored = [...wasLost].filter((k) => !isLost.has(k))
  return {
    add: added.length > 0 ? { abilities: added.map(({ keyword, param }) => (param === undefined ? { keyword } : { keyword, param })) } : undefined,
    eot: flag(added.length > 0 && added.every((g) => g.untilEndOfTurn)),
    chg: changed.length > 0 ? { changed: changed.map((g) => ({ keyword: g.keyword, param: g.param! })) } : undefined,
    rm: removed.length > 0 ? { keywords: removed } : undefined,
    rs: restored.length > 0 ? { keywords: restored } : undefined,
  }
}

function setPlayer(state: GameState, id: string, patch: Partial<PlayerState>): GameState {
  return { ...state, players: { ...state.players, [id]: { ...state.players[id], ...patch } } }
}

function setZone(state: GameState, ref: ZoneRef, ids: string[]): GameState {
  const player = state.players[ref.player]
  return setPlayer(state, ref.player, { zones: { ...player.zones, [ref.zone]: ids } })
}

function setCard(state: GameState, id: string, patch: Partial<CardInstance>): GameState {
  return { ...state, cards: { ...state.cards, [id]: { ...state.cards[id], ...patch } } }
}

/** Capacités données et perdues effacées (carte qui quitte le champ de bataille). */
function withoutAbilities(state: GameState, id: string): GameState {
  const { gained, lost, ...card } = state.cards[id]
  if (!gained && !lost) return state
  return { ...state, cards: { ...state.cards, [id]: card } }
}

/**
 * Fin du tour : les capacités données et les modifications de force et d'endurance « jusqu'à la fin du tour »
 * disparaissent, sur tous les permanents.
 */
function withoutEndOfTurnEffects(state: GameState): GameState {
  let cards: GameState['cards'] | null = null
  for (const [id, card] of Object.entries(state.cards)) {
    if (!card.ptTurn && !card.gained?.some((g) => g.untilEndOfTurn)) continue
    cards ??= { ...state.cards }
    const kept = (card.gained ?? []).filter((g) => !g.untilEndOfTurn)
    const { gained: _, ptTurn: _t, ...rest } = card
    cards[id] = kept.length > 0 ? { ...rest, gained: kept } : rest
  }
  return cards ? { ...state, cards } : state
}

/** La carte sans modification de force et d'endurance, ni permanente ni du tour (champs retirés plutôt que mis à 0/0). */
function withoutPt(state: GameState, id: string): GameState {
  if (!state.cards[id].ptMod && !state.cards[id].ptTurn) return state
  const { ptMod: _, ptTurn: _t, ...card } = state.cards[id]
  return { ...state, cards: { ...state.cards, [id]: card } }
}

const clampMod = (n: number) => Math.max(-MAX_PT_MOD, Math.min(MAX_PT_MOD, n))

/** Écart ajouté à la modification permanente (`ptMod`) ou du tour (`ptTurn`) ; champ retiré s'il revient à 0/0. */
function addPt(state: GameState, id: string, field: 'ptMod' | 'ptTurn', power: number, toughness: number): GameState {
  const mod = state.cards[id][field] ?? NO_PT
  const next = { power: clampMod(mod.power + power), toughness: clampMod(mod.toughness + toughness) }
  if (next.power !== 0 || next.toughness !== 0) return setCard(state, id, { [field]: next })
  const { [field]: _, ...card } = state.cards[id]
  return { ...state, cards: { ...state.cards, [id]: card } }
}

/** Noms des cartes visées par un effet de groupe : tous jusqu'à 4, sinon les 3 premiers et le nombre des autres. */
function namesOf(state: GameState, ids: string[]): string {
  const name = (id: string) => (state.cards[id].faceDown ? 'une carte face cachée' : cardName(state, id))
  if (ids.length <= 4) return join(ids.map(name))
  return join([...ids.slice(0, 3).map(name), `${ids.length - 3} autres cartes`])
}

/** Les mêmes cartes pour la ligne structurée (`null` : face cachée) et le nombre des autres. */
function namesParams(state: GameState, ids: string[]): { cards: LogParam; more?: number } {
  const shown = ids.length <= 4 ? ids : ids.slice(0, 3)
  const cards = { cards: shown.map((id) => (state.cards[id].faceDown ? null : logCard(state, id))) }
  return ids.length <= 4 ? { cards } : { cards, more: ids.length - 3 }
}

/** La carte sans écart de loyauté (champ retiré plutôt que mis à 0). */
function withoutLoyalty(state: GameState, id: string): GameState {
  if (state.cards[id].loyaltyMod === undefined) return state
  const { loyaltyMod: _, ...card } = state.cards[id]
  return { ...state, cards: { ...state.cards, [id]: card } }
}

/** La carte remise droite (champ retiré). */
function withoutRotation(state: GameState, id: string): GameState {
  if (!state.cards[id].rotated) return state
  const { rotated: _, ...card } = state.cards[id]
  return { ...state, cards: { ...state.cards, [id]: card } }
}

/** La carte de retour en phase (champ retiré). */
function withoutPhasing(state: GameState, id: string): GameState {
  if (!state.cards[id].phasedOut) return state
  const { phasedOut: _, ...card } = state.cards[id]
  return { ...state, cards: { ...state.cards, [id]: card } }
}

/** Règle 502.1 : au début de son tour, avant de dégager, les permanents hors phase du joueur reviennent en phase. */
function phaseInAllOf(state: GameState, playerId: string): GameState {
  let s = state
  for (const id of state.players[playerId].zones.battlefield) {
    if (!state.cards[id].phasedOut) continue
    s = log(withoutPhasing(s, id), null, `${phasingName(state, id)} revient en phase`, msgOf('phaseIn', { c: shownParam(state, id) }))
  }
  return s
}

function phasingName(state: GameState, id: string): string {
  return state.cards[id].faceDown ? 'une carte face cachée' : cardName(state, id)
}

function insertAt(list: string[], id: string, position: Position): string[] {
  if (position === 'top') return [id, ...list]
  if (position === 'bottom') return [...list, id]
  const index = Math.max(0, Math.min(list.length, Math.floor(position)))
  return [...list.slice(0, index), id, ...list.slice(index)]
}

function zoneLabel(state: GameState, actor: string, ref: ZoneRef): string {
  return ref.player === actor ? ZONE_LABELS[ref.zone] : `${ZONE_LABELS[ref.zone]} de ${state.players[ref.player].name}`
}

function draw(state: GameState, playerId: string, count: number): GameState {
  const player = state.players[playerId]
  const n = Math.min(Math.max(0, count), player.zones.library.length)
  const drawn = player.zones.library.slice(0, n)
  const cards = { ...state.cards }
  for (const id of drawn) cards[id] = { ...cards[id], knownBy: [] }
  return {
    ...setPlayer(state, playerId, {
      zones: { ...player.zones, library: player.zones.library.slice(n), hand: [...player.zones.hand, ...drawn] },
      stats: { ...player.stats, drawn: player.stats.drawn + n },
    }),
    cards,
  }
}

function shuffleLibrary(state: GameState, playerId: string, seed: Seed): GameState {
  const library = state.players[playerId].zones.library
  const cards = { ...state.cards }
  for (const id of library) cards[id] = { ...cards[id], knownBy: [] }
  return { ...setZone(state, { player: playerId, zone: 'library' }, shuffle(library, seed)), cards }
}

/** Retient (ou oublie) une carte posée dessus ou dessous d'une bibliothèque que son auteur regarde. */
function keepPlaced(state: GameState, actor: string, id: string, to: ZoneRef, position: Position): GameState {
  const kept = state.lookKept?.[actor] ?? { top: [], bottom: [] }
  const others = { top: kept.top.filter((k) => k !== id), bottom: kept.bottom.filter((k) => k !== id) }
  const looking = to.zone === 'library' && (state.lookingAt[actor] ?? []).includes(to.player)
  const side = looking && (position === 'top' || position === 'bottom') ? position : null
  const next = side ? { ...others, [side]: [...others[side], id] } : others
  if (!kept.top.includes(id) && !kept.bottom.includes(id) && !side) return state
  return { ...state, lookKept: { ...state.lookKept, [actor]: next } }
}

/** Mélange la bibliothèque sauf les cartes retenues, qui gardent leur place relative dessus et dessous. */
function shuffleExcept(state: GameState, playerId: string, seed: Seed, top: string[], bottom: string[]): GameState {
  const library = state.players[playerId].zones.library
  const kept = new Set([...top, ...bottom])
  const rest = library.filter((id) => !kept.has(id))
  const s = shuffleLibrary(setZone(state, { player: playerId, zone: 'library' }, rest), playerId, seed)
  return setZone(s, { player: playerId, zone: 'library' }, [...top, ...s.players[playerId].zones.library, ...bottom])
}

function untapAllOf(state: GameState, playerId: string): GameState {
  const cards = { ...state.cards }
  // Un permanent hors phase est traité comme absent : il reste engagé.
  for (const id of state.players[playerId].zones.battlefield) if (!cards[id].phasedOut) cards[id] = { ...cards[id], tapped: false }
  return { ...state, cards }
}

/** Passe au joueur suivant non éliminé : il dégage ses permanents et pioche 1. */
/** Fin de tour : les réserves de mana se vident, sauf celles des joueurs qui les gardent. */
function emptyManaPools(state: GameState): GameState {
  const players = { ...state.players }
  for (const [id, p] of Object.entries(players)) if (!p.keepMana) players[id] = { ...p, mana: NO_MANA }
  return { ...state, players }
}

/** Minuteur au changement de tour : le joueur qui finit son tour cumule sa durée ; le tour suivant part de `at`. */
function stampTurn(state: GameState, at: number | undefined): GameState {
  if (at === undefined) return state.turnStartedAt === undefined ? state : { ...state, turnStartedAt: undefined }
  if (state.turnStartedAt === undefined) return { ...state, turnStartedAt: at }
  const prev = state.activePlayer
  const playTime = { ...state.playTime, [prev]: (state.playTime?.[prev] ?? 0) + Math.max(0, at - state.turnStartedAt) }
  return { ...state, playTime, turnStartedAt: at }
}

function passTurn(state: GameState, actor: string | null, byHost = false, at?: number): GameState {
  const order = state.turnOrder
  const current = order.indexOf(state.activePlayer)
  for (let step = 1; step <= order.length; step++) {
    const index = (current + step) % order.length
    const next = order[index]
    if (state.players[next].eliminated) continue
    const turn = index <= current ? state.turn + 1 : state.turn
    let s: GameState = { ...withoutEndOfTurnEffects(stampTurn(state, at)), activePlayer: next, turn, firstTurnDone: true }
    s = log(s, actor, `Tour ${turn} : ${s.players[next].name}${byHost ? ' (passé par l’hôte)' : ''}`,
      msgOf('turn', { n: turn, p: { player: next }, host: flag(byHost) }))
    // Règle 725.2 : au début de l'entretien du joueur qui a l'initiative, il explore Les Souterrains (proposé).
    if (s.initiative === next) s = offerVenture(s, next)
    return draw(untapAllOf(phaseInAllOf(emptyManaPools(s), next), next), next, 1)
  }
  return state
}

/** Propose au joueur d'explorer Les Souterrains (une seule proposition à la fois). */
function offerVenture(state: GameState, player: string): GameState {
  const offers = state.ventureOffers ?? []
  return offers.includes(player) ? state : { ...state, ventureOffers: [...offers, player] }
}

function withoutOffer(state: GameState, player: string): GameState {
  return { ...state, ventureOffers: (state.ventureOffers ?? []).filter((p) => p !== player) }
}

/** Explore (règle 701.49) : entre dans la première salle d'un donjon, ou avance d'une salle ; dernière salle : donjon terminé. */
function venture(state: GameState, action: Extract<GameAction, { type: 'venture' }>): GameState {
  const player = state.players[action.actor]
  const step = ventureStep(player.dungeon, action.undercity ? 'undercity' : 'dungeon')
  const id = step.kind === 'advance' ? step.dungeon : step.kind === 'enter' ? step.dungeon : action.dungeon!
  const room = step.kind === 'advance' ? roomOf(id, action.room ?? step.next[0])! : firstRoom(id)
  const done = room.next.length === 0
  const dungeonsDone = (player.dungeonsDone ?? 0) + (done ? 1 : 0)
  let s = setPlayer(state, action.actor, { dungeon: { id, room: room.id }, ...(done ? { dungeonsDone } : {}) })
  if (action.undercity) s = withoutOffer(s, action.actor)
  const verb = step.kind === 'advance' ? 'avance dans' : 'entre dans'
  const end = done ? ` Donjon terminé (${dungeonsDone} au total).` : ''
  return log(s, action.actor, `${verb} ${DUNGEONS[id].the} : ${room.name} — ${room.text}${end}`)
}

function move(state: GameState, action: Extract<GameAction, { type: 'move' }>): GameState {
  const card = state.cards[action.id]
  const from = zoneOf(state, action.id)!
  const { to } = action

  if (from.zone === 'battlefield' && to.zone === 'battlefield' && from.player === to.player) {
    // L'ordre du champ de bataille est celui d'affichage : la dernière carte passe devant les autres.
    // Déplacée, la carte passe devant ; `top` la met derrière toutes les autres.
    const others = state.players[from.player].zones.battlefield.filter((id) => id !== action.id)
    const next = setZone(state, from, insertAt(others, action.id, action.position ?? 'bottom'))
    return setCard(next, action.id, { x: clampPct(action.x ?? card.x), y: clampPct(action.y ?? card.y) })
  }

  const willBeHidden = card.faceDown || !!action.faceDown || HIDDEN_ZONES.includes(to.zone)
  const name = willBeHidden ? 'une carte' : cardName(state, action.id)
  const route = { c: willBeHidden ? undefined : cardParam(state, action.id), from: zoneParam(action.actor, from), to: zoneParam(action.actor, to) }
  let next = setZone(state, from, state.players[from.player].zones[from.zone].filter((id) => id !== action.id))

  if (card.token && to.zone !== 'battlefield') {
    const cards = { ...next.cards }
    delete cards[action.id]
    return log({ ...next, cards }, action.actor, `${name} : ${zoneLabel(state, action.actor, from)} → ${zoneLabel(state, action.actor, to)} (disparaît)`,
      msgOf('move', { ...route, gone: 1 }))
  }

  const position: Position = action.position ?? (to.zone === 'library' ? 'top' : 'bottom')
  next = setZone(next, to, insertAt(next.players[to.player].zones[to.zone], action.id, position))
  next = keepPlaced(next, action.actor, action.id, to, position)

  const patch: Partial<CardInstance> = { knownBy: action.faceDown ? [action.actor] : [] }
  if (from.zone === 'battlefield') Object.assign(patch, { tapped: false, flipped: false, faceDown: false, counters: NO_COUNTERS })
  if (action.faceDown) patch.faceDown = true
  // Face cachée n'a de sens que sur le champ de bataille et en exil : ailleurs, la carte redevient normale.
  if (to.zone !== 'battlefield' && to.zone !== 'exile') patch.faceDown = false
  // Une carte qui reste face cachée (exil → champ de bataille…) garde ceux qui la connaissaient.
  else if (card.faceDown && from.zone !== 'battlefield' && !action.faceDown) patch.knownBy = card.knownBy
  if (to.zone === 'battlefield') {
    patch.x = clampPct(action.x ?? 50)
    patch.y = clampPct(action.y ?? 50)
  }
  next = setCard(next, action.id, patch)
  if (from.zone === 'battlefield') next = withoutPhasing(withoutAbilities(withoutRotation(withoutLoyalty(withoutPt(next, action.id), action.id), action.id), action.id), action.id)

  if (card.isCommander && from.zone === 'command' && to.zone !== 'command') {
    next = { ...next, commanderCasts: { ...next.commanderCasts, [action.id]: (next.commanderCasts[action.id] ?? 0) + 1 } }
  }
  if (from.zone === 'hand' && to.zone === 'battlefield' && isLand(state, action.id)) {
    const owner = next.players[card.owner]
    next = setPlayer(next, card.owner, { stats: { ...owner.stats, landsPlayed: owner.stats.landsPlayed + 1 } })
  }

  const where = to.zone === 'library' ? ` (${position === 'bottom' ? 'dessous' : position === 'top' ? 'dessus' : `position ${position}`})` : ''
  return log(next, action.actor, `${name} : ${zoneLabel(state, action.actor, from)} → ${zoneLabel(state, action.actor, to)}${where}`,
    msgOf('move', { ...route, pos: to.zone === 'library' ? position : undefined }))
}

/** Destination d'une carte d'un déplacement groupé : mon champ de bataille, sinon la zone de son propriétaire. */
export function groupDestination(state: GameState, actor: string, id: string, zone: PlayerZone): ZoneRef {
  return { player: zone === 'battlefield' ? actor : state.cards[id]?.owner ?? actor, zone }
}

function moveMany(state: GameState, action: Extract<GameAction, { type: 'moveMany' }>): GameState {
  const ids = action.random ? shuffle(action.ids, action.seed ?? 0) : action.ids
  const from = zoneOf(state, ids[0])!
  const to = groupDestination(state, action.actor, ids[0], action.zone)
  const library = action.zone === 'library'
  const side = action.position ?? 'top'
  // Chaque carte se pose sur les précédentes : la première de la liste est posée en dernier pour finir au-dessus
  // (dessus de la bibliothèque, fin du cimetière et de l'exil). Dessous de la bibliothèque, main, champ : dans l'ordre.
  const lastOnTop = (library && side === 'top') || action.zone === 'graveyard' || action.zone === 'exile'
  const order = lastOnTop ? [...ids].reverse() : ids
  let s = state
  for (const id of order) {
    const place = action.zone === 'battlefield' ? action.places?.[action.ids.indexOf(id)] : undefined
    s = move(s, {
      type: 'move', actor: action.actor, id, to: groupDestination(state, action.actor, id, action.zone),
      ...(library ? { position: side } : {}), ...(place ? { x: place.x, y: place.y } : {}),
    })
  }
  // Une seule ligne au journal ; vers une zone cachée, aucun nom (ni l'ordre choisi).
  const names = HIDDEN_ZONES.includes(action.zone) ? [] : ids.filter((id) => !state.cards[id].faceDown).map((id) => cardName(state, id))
  const details = [...(library ? [side === 'top' ? 'dessus' : 'dessous'] : []), ...(action.random ? ['ordre aléatoire'] : [])]
  const where = details.length > 0 ? ` (${details.join(', ')})` : ''
  const text = `${plural(ids.length, 'carte')} : ${zoneLabel(state, action.actor, from)} → ${zoneLabel(state, action.actor, to)}${where}${names.length > 0 ? ` : ${names.join(', ')}` : ''}`
  const named = HIDDEN_ZONES.includes(action.zone) ? [] : ids.filter((id) => !state.cards[id].faceDown)
  return log({ ...s, log: state.log }, action.actor, text, msgOf('moveMany', {
    n: ids.length, from: zoneParam(action.actor, from), to: zoneParam(action.actor, to),
    side: library ? side : undefined, random: flag(!!action.random),
    cards: named.length > 0 ? { cards: named.map((id) => logCard(state, id)) } : undefined,
  }))
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

/** Applique une action permise ; une action refusée renvoie l'état tel quel (même référence). */
export function applyAction(state: GameState, action: GameAction): GameState {
  if (canApply(state, action) !== null) return state

  switch (action.type) {
    case 'start': {
      let s: GameState = { ...state, started: true }
      // Anciennes parties : graines dérivées (graine + rang) ; nouvelles : une graine indépendante par joueur.
      const seedOf = (id: string, i: number): Seed =>
        action.seeds?.[id] ?? (typeof action.seed === 'number' ? action.seed + i : `${action.seed}:${i}`)
      Object.keys(s.players).forEach((id, i) => {
        s = draw(shuffleLibrary(s, id, seedOf(id, i)), id, OPENING_HAND)
      })
      // Premier joueur choisi par l'hôte : il commence, les autres places restent tirées au sort.
      const first = action.first
      const turnOrder = first
        ? [first, ...shuffle(Object.keys(s.players).filter((id) => id !== first), action.seed)]
        : shuffle(Object.keys(s.players), action.seed)
      s = { ...s, turnOrder, activePlayer: turnOrder[0], firstChosen: !!first }
      if (action.at !== undefined) s = { ...s, startedAt: action.at, turnStartedAt: action.at, playTime: {} }
      return log(s, null, `Début de partie : ${s.players[turnOrder[0]].name} commence${first ? " (choisi par l'hôte)" : ''}`,
        msgOf('start', { p: { player: turnOrder[0] }, chosen: flag(!!first) }))
    }

    case 'mulligan': {
      const player = state.players[action.actor]
      let s = setPlayer(state, action.actor, {
        zones: { ...player.zones, library: [...player.zones.library, ...player.zones.hand], hand: [] },
      })
      s = draw(shuffleLibrary(s, action.actor, action.seed), action.actor, OPENING_HAND)
      const n = player.mulligans + 1
      s = setPlayer(s, action.actor, { mulligans: n })
      return log(s, action.actor, `Mulligan n°${n}`, msgOf('mulligan', { n }))
    }

    case 'keep': {
      let s = setPlayer(state, action.actor, { kept: true })
      const firstPlayerDraws = Object.keys(state.players).length >= FIRST_PLAYER_DRAWS_FROM
      if (firstPlayerDraws && !state.firstTurnDone && action.actor === state.turnOrder[0]) {
        s = { ...draw(s, action.actor, 1), firstTurnDone: true }
      }
      return log(s, action.actor, 'Garde sa main', msgOf('keep'))
    }

    case 'draw': {
      if (state.players[action.actor].zones.library.length === 0) return log(state, action.actor, 'Bibliothèque vide', msgOf('libraryEmpty'))
      const n = Math.min(action.count, state.players[action.actor].zones.library.length)
      return log(draw(state, action.actor, n), action.actor, `Pioche ${plural(n, 'carte')}`, msgOf('draw', { n }))
    }

    case 'roll': {
      const r = rollDice(action.sides, action.count, action.seed)
      const msg = msgOf('roll', { sides: action.sides, r })
      return { ...state, log: [...state.log, { turn: state.turn, actor: action.actor, text: rollText(action.sides, r), visibleTo: 'all', roll: true, msg }] }
    }

    case 'shuffle':
      return log(shuffleLibrary(state, action.actor, action.seed), action.actor, 'Mélange sa bibliothèque', msgOf('shuffle'))

    case 'endTurn':
      return passTurn(state, action.actor, action.byHost, action.at)

    case 'moveTop': {
      const { type: _type, ...rest } = action
      return move(state, { ...rest, type: 'move', id: state.players[action.actor].zones.library[0] })
    }

    case 'move':
      return move(state, action)

    case 'moveMany':
      return moveMany(state, action)

    case 'giveControl': {
      const from = zoneOf(state, action.id)!
      let s = setZone(state, from, state.players[from.player].zones.battlefield.filter((id) => id !== action.id))
      s = setZone(s, { player: action.to, zone: 'battlefield' }, [...s.players[action.to].zones.battlefield, action.id])
      // Règle 708.5 : le contrôleur d'une carte face cachée peut la regarder.
      const card = state.cards[action.id]
      if (card.faceDown) s = setCard(s, action.id, { knownBy: [...new Set([...card.knownBy, action.to])] })
      const what = state.cards[action.id].faceDown ? 'd’une carte face cachée' : `de ${cardName(state, action.id)}`
      return log(s, action.actor, `donne le contrôle ${what} à ${state.players[action.to].name}`,
        msgOf('giveControl', { c: shownParam(state, action.id), p: { player: action.to } }))
    }

    case 'tap':
      return setCard(state, action.id, { tapped: !state.cards[action.id].tapped })

    case 'untapAll':
      return untapAllOf(state, action.actor)

    case 'counter': {
      const card = state.cards[action.id]
      const value = Math.max(0, card.counters[action.kind] + action.delta)
      const label = { plus: '+1/+1', minus: '-1/-1', other: 'compteur' }[action.kind]
      const name = card.faceDown ? 'une carte' : cardName(state, action.id)
      return log(setCard(state, action.id, { counters: { ...card.counters, [action.kind]: value } }), action.actor, `${name} : ${label} (${value})`,
        msgOf('counter', { c: shownParam(state, action.id), kind: action.kind, n: value }))
    }

    case 'pt':
    case 'ptTurn': {
      const card = state.cards[action.id]
      const s = addPt(state, action.id, action.type === 'pt' ? 'ptMod' : 'ptTurn', action.power, action.toughness)
      const name = card.faceDown ? 'une carte face cachée' : cardName(state, action.id)
      return log(s, action.actor, `${name} : ${ptLog(state.catalogs[card.owner], s.cards[action.id])}`,
        msgOf('pt', { c: shownParam(state, action.id), ...ptParams(state.catalogs[card.owner], s.cards[action.id]) }))
    }

    case 'effect': {
      const eot = action.untilEndOfTurn ?? false
      let s = state
      for (const id of action.ids) {
        if (action.power !== 0 || action.toughness !== 0) s = addPt(s, id, eot ? 'ptTurn' : 'ptMod', action.power, action.toughness)
        if (action.gained.length === 0) continue
        const card = s.cards[id]
        const { gained: _g, lost: _l, ...rest } = card
        const next = addAbilities(card, printedKeywordsOf(s.catalogs[card.owner], card), action.gained, eot)
        s = { ...s, cards: { ...s.cards, [id]: { ...rest, ...next } } }
      }
      const what = [
        ...(action.power !== 0 || action.toughness !== 0 ? [ptText({ power: action.power, toughness: action.toughness })] : []),
        ...action.gained.map((c) => abilityText(typeof c === 'string' ? { keyword: c } : c)),
      ]
      return log(s, action.actor, `donne ${join(what)} à ${namesOf(state, action.ids)}${eot ? ' (jusqu’à la fin du tour)' : ''}`, msgOf('effect', {
        pt: action.power !== 0 || action.toughness !== 0 ? ptText({ power: action.power, toughness: action.toughness }) : undefined,
        ab: action.gained.length > 0 ? { abilities: action.gained.map((c) => (typeof c === 'string' ? { keyword: c } : c)) } : undefined,
        ...namesParams(state, action.ids), eot: flag(eot),
      }))
    }

    case 'abilities': {
      const card = state.cards[action.id]
      const next = nextAbilities(card, action.gained, action.lost, action.untilEndOfTurn ?? false)
      const name = card.faceDown ? 'une carte face cachée' : cardName(state, action.id)
      const text = abilitiesLog(name, card, next)
      if (text === null) return state
      const { gained: _g, lost: _l, ...rest } = card
      return log({ ...state, cards: { ...state.cards, [action.id]: { ...rest, ...next } } }, action.actor, text,
        msgOf('abilities', { c: shownParam(state, action.id), ...abilitiesParams(card, next) }))
    }

    case 'loyalty': {
      const card = state.cards[action.id]
      // Face cachée, ce n'est qu'une créature 2/2 : pas de loyauté (et son nom ne doit pas paraître au journal).
      if (card.faceDown) return state
      const catalog = state.catalogs[card.owner]
      const loyaltyMod = clampLoyalty(baseLoyalty(catalog, card), (card.loyaltyMod ?? 0) + action.delta)
      if (loyaltyMod === (card.loyaltyMod ?? 0)) return state
      const s = loyaltyMod === 0 ? withoutLoyalty(state, action.id) : setCard(state, action.id, { loyaltyMod })
      const shown = loyaltyStats(catalog, s.cards[action.id])
      return log(s, action.actor, `${cardName(state, action.id)} : ${shown ? `loyauté ${shown.text}` : 'loyauté d’origine'}`,
        msgOf('loyalty', { c: cardParam(state, action.id), v: shown?.text }))
    }

    case 'createToken': {
      const id = `t${state.nextTokenId}`
      const token: CardInstance = {
        id, owner: action.actor, ref: null, token: action.copy ? { ...action.token, copy: true } : action.token, isCommander: false, tapped: false, flipped: false,
        faceDown: false, counters: NO_COUNTERS, x: clampPct(action.x), y: clampPct(action.y), knownBy: [],
      }
      let s: GameState = { ...state, cards: { ...state.cards, [id]: token }, nextTokenId: state.nextTokenId + 1 }
      s = setZone(s, { player: action.actor, zone: 'battlefield' }, [...s.players[action.actor].zones.battlefield, id])
      return log(s, action.actor, `Crée un jeton ${action.token.name}${action.copy ? ' (copie)' : ''}`,
        msgOf('createToken', { name: action.token.name, copy: flag(!!action.copy) }))
    }

    case 'flip': {
      const card = state.cards[action.id]
      const name = card.faceDown ? 'une carte face cachée' : cardName(state, action.id)
      return log(setCard(state, action.id, { flipped: !card.flipped }), action.actor, `Transforme ${name}`, msgOf('flip', { c: shownParam(state, action.id) }))
    }

    case 'rotate':
      return state.cards[action.id].rotated ? withoutRotation(state, action.id) : setCard(state, action.id, { rotated: true })

    case 'phase': {
      const phasedOut = !state.cards[action.id].phasedOut
      const s = phasedOut ? setCard(state, action.id, { phasedOut: true }) : withoutPhasing(state, action.id)
      return log(s, action.actor, `${phasingName(state, action.id)} ${phasedOut ? 'passe hors phase' : 'revient en phase'}`,
        msgOf(phasedOut ? 'phaseOut' : 'phaseIn', { c: shownParam(state, action.id) }))
    }

    case 'faceDown': {
      const faceDown = !state.cards[action.id].faceDown
      const s = setCard(state, action.id, { faceDown, knownBy: faceDown ? [action.actor] : [] })
      return log(s, action.actor, faceDown ? 'Met une carte face cachée' : `Retourne ${cardName(state, action.id)} face visible`,
        faceDown ? msgOf('faceDown') : msgOf('faceUp', { c: cardParam(state, action.id) }))
    }

    case 'commanderTax': {
      const casts = Math.max(0, (state.commanderCasts[action.id] ?? 0) + action.delta)
      const s = { ...state, commanderCasts: { ...state.commanderCasts, [action.id]: casts } }
      return log(s, action.actor, `Taxe de ${cardName(state, action.id)} : ${taxOf(s, action.id)}`,
        msgOf('commanderTax', { c: cardParam(state, action.id), n: taxOf(s, action.id) }))
    }

    case 'life': {
      const target = state.players[action.target]
      const life = target.life + action.delta
      return log(setPlayer(state, action.target, { life }), action.actor, `${target.name} ${target.life} → ${life}`,
        msgOf('life', { p: { player: action.target }, from: target.life, to: life }))
    }

    case 'poison': {
      const target = state.players[action.target]
      const poison = Math.max(0, target.poison + action.delta)
      return log(setPlayer(state, action.target, { poison }), action.actor, `${target.name} : poison ${poison}`,
        msgOf('poison', { p: { player: action.target }, n: poison }))
    }

    case 'playerCounter': {
      const target = state.players[action.target]
      const value = Math.max(0, (target.counters[action.name] ?? 0) + action.delta)
      const s = setPlayer(state, action.target, { counters: { ...target.counters, [action.name]: value } })
      return log(s, action.actor, `${target.name} : ${action.name} ${value}`,
        msgOf('playerCounter', { p: { player: action.target }, name: action.name, n: value }))
    }

    case 'commanderDamage': {
      const target = state.players[action.target]
      const before = target.commanderDamage[action.commander] ?? 0
      const after = Math.max(0, before + action.delta)
      const life = target.life - (after - before)
      const s = setPlayer(state, action.target, { life, commanderDamage: { ...target.commanderDamage, [action.commander]: after } })
      return log(s, action.actor, `${target.name} : ${plural(after, 'blessure')} de ${cardName(state, action.commander)} (vie ${life})`,
        msgOf('commanderDamage', { p: { player: action.target }, n: after, c: cardParam(state, action.commander), life }))
    }

    case 'setMonarch':
      return log({ ...state, monarch: action.to }, action.actor, action.to ? `${state.players[action.to].name} devient le monarque` : 'Plus de monarque',
        action.to ? msgOf('monarch', { p: { player: action.to } }) : msgOf('noMonarch'))

    case 'setInitiative': {
      // Règle 725 : prendre l'initiative fait explorer Les Souterrains ; proposé au joueur par un bouton.
      const s = action.to ? offerVenture(state, action.to) : state
      return log({ ...s, initiative: action.to }, action.actor, action.to ? `${state.players[action.to].name} prend l’initiative` : 'Plus d’initiative',
        action.to ? msgOf('initiative', { p: { player: action.to } }) : msgOf('noInitiative'))
    }

    case 'venture':
      return venture(state, action)

    case 'skipVenture':
      return log(withoutOffer(state, action.actor), action.actor, 'n’explore pas Les Souterrains pour l’instant')

    case 'eliminate': {
      let s = setPlayer(state, action.target, { eliminated: true })
      s = log(s, action.actor, `${state.players[action.target].name} est éliminé`, msgOf('eliminated', { p: { player: action.target } }))
      return state.activePlayer === action.target ? passTurn(s, null, false, action.at) : s
    }

    case 'reveal': {
      const ids = action.ids === 'hand' ? state.players[action.actor].zones.hand : action.ids
      const to = action.to === 'all' ? Object.keys(state.players) : action.to
      const cards = { ...state.cards }
      for (const id of ids) cards[id] = { ...cards[id], knownBy: [...new Set([...cards[id].knownBy, ...to])] }
      const names = ids.map((id) => cardName(state, id)).join(', ')
      const s = { ...state, cards }
      const revealed = { cards: ids.map((id) => logCard(state, id)) }
      if (action.to === 'all') return log(s, action.actor, `révèle : ${names}`, msgOf('revealAll', { cards: revealed }))
      const who = action.to.map((p) => state.players[p].name).join(', ')
      const players = { players: action.to }
      return log(
        log(s, action.actor, `révèle ${plural(ids.length, 'carte')} à ${who}`, msgOf('revealTo', { n: ids.length, to: players })),
        action.actor, `Révélé à ${who} : ${names}`, msgOf('revealedTo', { to: players, cards: revealed }), [...new Set([action.actor, ...action.to])],
      )
    }

    case 'revealTop': {
      // Visible de tous jusqu'à ce qu'elle bouge : pioche, déplacement et mélange vident knownBy.
      const top = state.players[action.actor].zones.library[0]
      if (!top) return log(state, action.actor, 'Bibliothèque vide', msgOf('libraryEmpty'))
      const s = setCard(state, top, { knownBy: [EVERYONE] })
      return log(s, action.actor, `révèle ${cardName(state, top)}`, msgOf('revealTop', { c: cardParam(state, top) }))
    }

    case 'toggleTopRevealed': {
      const topRevealed = !state.players[action.actor].topRevealed
      return log(setPlayer(state, action.actor, { topRevealed }), action.actor, topRevealed ? 'joue avec la carte du dessus révélée' : 'cache la carte du dessus',
        msgOf(topRevealed ? 'topRevealed' : 'topHidden'))
    }

    case 'mana': {
      const pool = state.players[action.actor].mana
      return setPlayer(state, action.actor, { mana: { ...pool, [action.color]: Math.max(0, pool[action.color] + action.delta) } })
    }

    case 'clearMana':
      return setPlayer(state, action.actor, { mana: NO_MANA })

    case 'toggleKeepMana': {
      const keepMana = !state.players[action.actor].keepMana
      return log(setPlayer(state, action.actor, { keepMana }), action.actor,
        keepMana ? 'garde sa réserve de mana d’un tour à l’autre' : 'ne garde plus sa réserve de mana', msgOf(keepMana ? 'keepMana' : 'noKeepMana'))
    }

    case 'togglePeekTop': {
      const peekTop = !state.players[action.actor].peekTop
      const text = peekTop ? 'regarde la carte du dessus de sa bibliothèque en permanence' : 'ne regarde plus la carte du dessus'
      return log(setPlayer(state, action.actor, { peekTop }), action.actor, text, msgOf(peekTop ? 'peekTop' : 'noPeekTop'))
    }

    case 'look':
    case 'search': {
      const library = state.players[action.target].zones.library
      const seen = action.type === 'look' ? library.slice(0, action.count) : library
      const cards = { ...state.cards }
      for (const id of seen) cards[id] = { ...cards[id], knownBy: [...new Set([...cards[id].knownBy, action.actor])] }
      const looking = state.lookingAt[action.actor] ?? []
      const s: GameState = {
        ...state,
        cards,
        lookingAt: { ...state.lookingAt, [action.actor]: looking.includes(action.target) ? looking : [...looking, action.target] },
      }
      const of = action.target === action.actor ? 'sa bibliothèque' : `la bibliothèque de ${state.players[action.target].name}`
      const p = otherParam(action.actor, action.target)
      if (action.type === 'search') return log(s, action.actor, `fouille ${of}`, msgOf('search', { p }))
      const what = seen.length === 1 ? 'la carte du dessus' : `les ${seen.length} cartes du dessus`
      const names = seen.map((id) => cardName(state, id)).join(', ')
      return log(
        log(s, action.actor, `regarde ${what} de ${of}`, msgOf('look', { n: seen.length, p })),
        action.actor, `Tu as vu : ${names}`, msgOf('seen', { cards: { cards: seen.map((id) => logCard(state, id)) } }), [action.actor],
      )
    }

    case 'reorderTop': {
      // Les cartes échangent leurs places entre les positions qu'elles occupent déjà ; ce que chacun sait d'elles ne change pas.
      const library = state.players[action.target].zones.library
      const slots = action.ids.map((id) => library.indexOf(id)).sort((a, b) => a - b)
      const next = [...library]
      slots.forEach((slot, i) => { next[slot] = action.ids[i] })
      const s = setZone(state, { player: action.target, zone: 'library' }, next)
      const of = action.target === action.actor ? 'sa bibliothèque' : `la bibliothèque de ${state.players[action.target].name}`
      const what = action.ids.length === 1 ? 'la carte du dessus' : `les ${action.ids.length} cartes du dessus`
      return log(s, action.actor, `remet ${what} de ${of} dans l’ordre de son choix`,
        msgOf('reorder', { n: action.ids.length, p: otherParam(action.actor, action.target) }))
    }

    case 'endLook': {
      const library = state.players[action.target].zones.library
      // Une action jouée avant cette règle (partie rejouée) mélange toute la bibliothèque, comme à l'époque.
      const kept = (action.keep && state.lookKept?.[action.actor]) || { top: [], bottom: [] }
      // Dans l'ordre de la bibliothèque : la dernière carte posée dessus est au-dessus.
      const top = library.filter((id) => kept.top.includes(id))
      const bottom = library.filter((id) => kept.bottom.includes(id))
      const cards = { ...state.cards }
      for (const id of library) {
        cards[id] = { ...cards[id], knownBy: cards[id].knownBy.filter((p) => p !== action.actor) }
      }
      let s: GameState = {
        ...state,
        cards,
        lookingAt: { ...state.lookingAt, [action.actor]: state.lookingAt[action.actor].filter((p) => p !== action.target) },
      }
      const placed = state.lookKept?.[action.actor]
      if (placed) {
        const rest = { top: placed.top.filter((id) => !library.includes(id)), bottom: placed.bottom.filter((id) => !library.includes(id)) }
        const { [action.actor]: _, ...others } = state.lookKept!
        s = { ...s, lookKept: rest.top.length || rest.bottom.length ? { ...others, [action.actor]: rest } : others }
      }
      const of = action.target === action.actor ? 'sa bibliothèque' : `la bibliothèque de ${state.players[action.target].name}`
      const p = otherParam(action.actor, action.target)
      if (!action.shuffle) return log(s, action.actor, `arrête de regarder ${of}`, msgOf('stopLook', { p }))
      s = shuffleExcept(s, action.target, action.seed ?? 0, top, bottom)
      // Celui qui a posé les cartes épargnées sait ce qu'elles sont ; les autres non.
      s = { ...s, cards: { ...s.cards } }
      for (const id of [...top, ...bottom]) s.cards[id] = { ...s.cards[id], knownBy: [action.actor] }
      const count = (n: number) => (n === 1 ? 'une carte' : `${n} cartes`)
      const parts = [
        ...(top.length ? [`met ${count(top.length)} au-dessus`] : []),
        ...(bottom.length ? [`${top.length ? '' : 'met '}${count(bottom.length)} dessous`] : []),
      ]
      const tail = parts.length === 0 ? '' : parts.length === 1 ? ` et ${parts[0]}` : `, ${parts[0]} et ${parts[1]}`
      return log(s, action.actor, `mélange ${of}${tail}`,
        msgOf('shuffleLook', { p, top: top.length || undefined, bottom: bottom.length || undefined }))
    }

    default:
      return state
  }
}

export { controllerOf, zoneOf }
