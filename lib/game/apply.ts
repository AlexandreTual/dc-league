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
  type PlayerState,
  type PlayerZone,
  type Position,
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

export function bottomCount(state: GameState, playerId: string): number {
  return Math.max(0, (state.players[playerId]?.mulligans ?? 0) - 1)
}

export function taxOf(state: Pick<GameState, 'commanderCasts'>, id: string): number {
  return COMMANDER_TAX_STEP * (state.commanderCasts[id] ?? 0)
}

/** Mention affichée sur un jeton, pour le distinguer d'une vraie carte. */
export function tokenBadge(card: Pick<CardInstance, 'token'>): 'Jeton' | 'Copie' | null {
  if (!card.token) return null
  return card.token.copy ? 'Copie' : 'Jeton'
}

export type CardInfo = { name: string; image: string | null; typeLine: string; faces: CardFace[] | null; hidden: boolean }

const UNKNOWN: CardInfo = { name: 'une carte', image: null, typeLine: '', faces: null, hidden: true }

/** Nom, image et type affichés d'une carte, à partir du catalogue de son propriétaire. */
export function cardInfo(
  catalog: Catalog | undefined,
  card: Pick<CardInstance, 'ref' | 'token' | 'flipped' | 'faceDown'>,
  lang: 'fr' | 'en',
): CardInfo {
  if (card.token) return { name: card.token.name, image: card.token.image, typeLine: card.token.typeLine, faces: null, hidden: false }
  const entry = card.ref === null ? undefined : catalog?.entries.find((e) => e.ref === card.ref)
  const shown = (lang === 'fr' ? entry?.fr : null) ?? entry?.en
  if (!shown) return UNKNOWN
  const faces = shown.faces
  const face = card.flipped && faces && faces.length > 1 ? faces[1] : null
  return {
    name: face ? (face.printed_name ?? face.name) : (shown.printed_name ?? shown.name),
    image: face?.image_normal ?? shown.image_normal,
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

function log(state: GameState, actor: string | null, text: string, visibleTo: string[] | 'all' = 'all'): GameState {
  return { ...state, log: [...state.log, { turn: state.turn, actor, text, visibleTo }] }
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

function shuffleLibrary(state: GameState, playerId: string, seed: number): GameState {
  const library = state.players[playerId].zones.library
  const cards = { ...state.cards }
  for (const id of library) cards[id] = { ...cards[id], knownBy: [] }
  return { ...setZone(state, { player: playerId, zone: 'library' }, shuffle(library, seed)), cards }
}

function untapAllOf(state: GameState, playerId: string): GameState {
  const cards = { ...state.cards }
  for (const id of state.players[playerId].zones.battlefield) cards[id] = { ...cards[id], tapped: false }
  return { ...state, cards }
}

/** Passe au joueur suivant non éliminé : il dégage ses permanents et pioche 1. */
/** Fin de tour : les réserves de mana se vident, sauf celles des joueurs qui les gardent. */
function emptyManaPools(state: GameState): GameState {
  const players = { ...state.players }
  for (const [id, p] of Object.entries(players)) if (!p.keepMana) players[id] = { ...p, mana: NO_MANA }
  return { ...state, players }
}

function passTurn(state: GameState, actor: string | null, byHost = false): GameState {
  const order = state.turnOrder
  const current = order.indexOf(state.activePlayer)
  for (let step = 1; step <= order.length; step++) {
    const index = (current + step) % order.length
    const next = order[index]
    if (state.players[next].eliminated) continue
    const turn = index <= current ? state.turn + 1 : state.turn
    let s: GameState = { ...state, activePlayer: next, turn, firstTurnDone: true }
    s = draw(untapAllOf(emptyManaPools(s), next), next, 1)
    return log(s, actor, `Tour ${turn} : ${s.players[next].name}${byHost ? ' (passé par l’hôte)' : ''}`)
  }
  return state
}

function move(state: GameState, action: Extract<GameAction, { type: 'move' }>): GameState {
  const card = state.cards[action.id]
  const from = zoneOf(state, action.id)!
  const { to } = action

  if (from.zone === 'battlefield' && to.zone === 'battlefield' && from.player === to.player) {
    return setCard(state, action.id, { x: clampPct(action.x ?? card.x), y: clampPct(action.y ?? card.y) })
  }

  const willBeHidden = card.faceDown || !!action.faceDown || HIDDEN_ZONES.includes(to.zone)
  const name = willBeHidden ? 'une carte' : cardName(state, action.id)
  let next = setZone(state, from, state.players[from.player].zones[from.zone].filter((id) => id !== action.id))

  if (card.token && to.zone !== 'battlefield') {
    const cards = { ...next.cards }
    delete cards[action.id]
    return log({ ...next, cards }, action.actor, `${name} : ${zoneLabel(state, action.actor, from)} → ${zoneLabel(state, action.actor, to)} (disparaît)`)
  }

  const position: Position = action.position ?? (to.zone === 'library' ? 'top' : 'bottom')
  next = setZone(next, to, insertAt(next.players[to.player].zones[to.zone], action.id, position))

  const patch: Partial<CardInstance> = { knownBy: action.faceDown ? [action.actor] : [] }
  if (from.zone === 'battlefield') Object.assign(patch, { tapped: false, flipped: false, faceDown: false, counters: NO_COUNTERS })
  if (action.faceDown) patch.faceDown = true
  if (to.zone === 'battlefield') {
    patch.x = clampPct(action.x ?? 50)
    patch.y = clampPct(action.y ?? 50)
  }
  next = setCard(next, action.id, patch)

  if (card.isCommander && from.zone === 'command' && to.zone !== 'command') {
    next = { ...next, commanderCasts: { ...next.commanderCasts, [action.id]: (next.commanderCasts[action.id] ?? 0) + 1 } }
  }
  if (from.zone === 'hand' && to.zone === 'battlefield' && isLand(state, action.id)) {
    const owner = next.players[card.owner]
    next = setPlayer(next, card.owner, { stats: { ...owner.stats, landsPlayed: owner.stats.landsPlayed + 1 } })
  }

  const where = to.zone === 'library' ? ` (${position === 'bottom' ? 'dessous' : position === 'top' ? 'dessus' : `position ${position}`})` : ''
  return log(next, action.actor, `${name} : ${zoneLabel(state, action.actor, from)} → ${zoneLabel(state, action.actor, to)}${where}`)
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

/** Applique une action permise ; une action refusée renvoie l'état tel quel (même référence). */
export function applyAction(state: GameState, action: GameAction): GameState {
  if (canApply(state, action) !== null) return state

  switch (action.type) {
    case 'start': {
      let s: GameState = { ...state, started: true }
      Object.keys(s.players).forEach((id, i) => {
        s = draw(shuffleLibrary(s, id, action.seed + i), id, OPENING_HAND)
      })
      const turnOrder = shuffle(Object.keys(s.players), action.seed)
      s = { ...s, turnOrder, activePlayer: turnOrder[0] }
      return log(s, null, `Début de partie : ${s.players[turnOrder[0]].name} commence`)
    }

    case 'mulligan': {
      const player = state.players[action.actor]
      let s = setPlayer(state, action.actor, {
        zones: { ...player.zones, library: [...player.zones.library, ...player.zones.hand], hand: [] },
      })
      s = draw(shuffleLibrary(s, action.actor, action.seed), action.actor, OPENING_HAND)
      const n = player.mulligans + 1
      s = setPlayer(s, action.actor, { mulligans: n })
      const k = bottomCount(s, action.actor)
      return log(s, action.actor, k === 0 ? `Mulligan n°${n} (gratuit)` : `Mulligan n°${n} : met ${k} carte(s) en dessous`)
    }

    case 'keep': {
      let s = setPlayer(state, action.actor, { kept: true })
      const firstPlayerDraws = Object.keys(state.players).length >= FIRST_PLAYER_DRAWS_FROM
      if (firstPlayerDraws && !state.firstTurnDone && action.actor === state.turnOrder[0]) {
        s = { ...draw(s, action.actor, 1), firstTurnDone: true }
      }
      return log(s, action.actor, 'Garde sa main')
    }

    case 'draw': {
      if (state.players[action.actor].zones.library.length === 0) return log(state, action.actor, 'Bibliothèque vide')
      const n = Math.min(action.count, state.players[action.actor].zones.library.length)
      return log(draw(state, action.actor, n), action.actor, `Pioche ${plural(n, 'carte')}`)
    }

    case 'shuffle':
      return log(shuffleLibrary(state, action.actor, action.seed), action.actor, 'Mélange sa bibliothèque')

    case 'endTurn':
      return passTurn(state, action.actor, action.byHost)

    case 'moveTop': {
      const { type: _type, ...rest } = action
      return move(state, { ...rest, type: 'move', id: state.players[action.actor].zones.library[0] })
    }

    case 'move':
      return move(state, action)

    case 'giveControl': {
      const from = zoneOf(state, action.id)!
      let s = setZone(state, from, state.players[from.player].zones.battlefield.filter((id) => id !== action.id))
      s = setZone(s, { player: action.to, zone: 'battlefield' }, [...s.players[action.to].zones.battlefield, action.id])
      return log(s, action.actor, `donne le contrôle de ${cardName(state, action.id)} à ${state.players[action.to].name}`)
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
      return log(setCard(state, action.id, { counters: { ...card.counters, [action.kind]: value } }), action.actor, `${name} : ${label} (${value})`)
    }

    case 'createToken': {
      const id = `t${state.nextTokenId}`
      const token: CardInstance = {
        id, owner: action.actor, ref: null, token: action.copy ? { ...action.token, copy: true } : action.token, isCommander: false, tapped: false, flipped: false,
        faceDown: false, counters: NO_COUNTERS, x: clampPct(action.x), y: clampPct(action.y), knownBy: [],
      }
      let s: GameState = { ...state, cards: { ...state.cards, [id]: token }, nextTokenId: state.nextTokenId + 1 }
      s = setZone(s, { player: action.actor, zone: 'battlefield' }, [...s.players[action.actor].zones.battlefield, id])
      return log(s, action.actor, `Crée un jeton ${action.token.name}${action.copy ? ' (copie)' : ''}`)
    }

    case 'flip': {
      const flipped = !state.cards[action.id].flipped
      return log(setCard(state, action.id, { flipped }), action.actor, `Transforme ${cardName(state, action.id)}`)
    }

    case 'faceDown': {
      const faceDown = !state.cards[action.id].faceDown
      const s = setCard(state, action.id, { faceDown, knownBy: faceDown ? [action.actor] : [] })
      return log(s, action.actor, faceDown ? 'Met une carte face cachée' : `Retourne ${cardName(state, action.id)} face visible`)
    }

    case 'commanderTax': {
      const casts = Math.max(0, (state.commanderCasts[action.id] ?? 0) + action.delta)
      const s = { ...state, commanderCasts: { ...state.commanderCasts, [action.id]: casts } }
      return log(s, action.actor, `Taxe de ${cardName(state, action.id)} : ${taxOf(s, action.id)}`)
    }

    case 'life': {
      const target = state.players[action.target]
      const life = target.life + action.delta
      return log(setPlayer(state, action.target, { life }), action.actor, `${target.name} ${target.life} → ${life}`)
    }

    case 'poison': {
      const target = state.players[action.target]
      const poison = Math.max(0, target.poison + action.delta)
      return log(setPlayer(state, action.target, { poison }), action.actor, `${target.name} : poison ${poison}`)
    }

    case 'playerCounter': {
      const target = state.players[action.target]
      const value = Math.max(0, (target.counters[action.name] ?? 0) + action.delta)
      const s = setPlayer(state, action.target, { counters: { ...target.counters, [action.name]: value } })
      return log(s, action.actor, `${target.name} : ${action.name} ${value}`)
    }

    case 'commanderDamage': {
      const target = state.players[action.target]
      const before = target.commanderDamage[action.commander] ?? 0
      const after = Math.max(0, before + action.delta)
      const life = target.life - (after - before)
      const s = setPlayer(state, action.target, { life, commanderDamage: { ...target.commanderDamage, [action.commander]: after } })
      return log(s, action.actor, `${target.name} : ${plural(after, 'blessure')} de ${cardName(state, action.commander)} (vie ${life})`)
    }

    case 'setMonarch':
      return log({ ...state, monarch: action.to }, action.actor, action.to ? `${state.players[action.to].name} devient le monarque` : 'Plus de monarque')

    case 'setInitiative':
      return log({ ...state, initiative: action.to }, action.actor, action.to ? `${state.players[action.to].name} prend l’initiative` : 'Plus d’initiative')

    case 'eliminate': {
      let s = setPlayer(state, action.target, { eliminated: true })
      s = log(s, action.actor, `${state.players[action.target].name} est éliminé`)
      return state.activePlayer === action.target ? passTurn(s, null) : s
    }

    case 'reveal': {
      const ids = action.ids === 'hand' ? state.players[action.actor].zones.hand : action.ids
      const to = action.to === 'all' ? Object.keys(state.players) : action.to
      const cards = { ...state.cards }
      for (const id of ids) cards[id] = { ...cards[id], knownBy: [...new Set([...cards[id].knownBy, ...to])] }
      const names = ids.map((id) => cardName(state, id)).join(', ')
      const s = { ...state, cards }
      if (action.to === 'all') return log(s, action.actor, `révèle : ${names}`)
      const who = action.to.map((p) => state.players[p].name).join(', ')
      return log(log(s, action.actor, `révèle ${plural(ids.length, 'carte')} à ${who}`), action.actor, `Révélé à ${who} : ${names}`, [...new Set([action.actor, ...action.to])])
    }

    case 'revealTop': {
      // Visible de tous jusqu'à ce qu'elle bouge : pioche, déplacement et mélange vident knownBy.
      const top = state.players[action.actor].zones.library[0]
      if (!top) return log(state, action.actor, 'Bibliothèque vide')
      const s = setCard(state, top, { knownBy: [EVERYONE] })
      return log(s, action.actor, `révèle ${cardName(state, top)}`)
    }

    case 'toggleTopRevealed': {
      const topRevealed = !state.players[action.actor].topRevealed
      return log(setPlayer(state, action.actor, { topRevealed }), action.actor, topRevealed ? 'joue avec la carte du dessus révélée' : 'cache la carte du dessus')
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
        keepMana ? 'garde sa réserve de mana d’un tour à l’autre' : 'ne garde plus sa réserve de mana')
    }

    case 'togglePeekTop': {
      const peekTop = !state.players[action.actor].peekTop
      const text = peekTop ? 'regarde la carte du dessus de sa bibliothèque en permanence' : 'ne regarde plus la carte du dessus'
      return log(setPlayer(state, action.actor, { peekTop }), action.actor, text)
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
      if (action.type === 'search') return log(s, action.actor, `fouille ${of}`)
      const what = seen.length === 1 ? 'la carte du dessus' : `les ${seen.length} cartes du dessus`
      const names = seen.map((id) => cardName(state, id)).join(', ')
      return log(log(s, action.actor, `regarde ${what} de ${of}`), action.actor, `Tu as vu : ${names}`, [action.actor])
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
      return log(s, action.actor, `remet ${what} de ${of} dans l’ordre de son choix`)
    }

    case 'endLook': {
      const cards = { ...state.cards }
      for (const id of state.players[action.target].zones.library) {
        cards[id] = { ...cards[id], knownBy: cards[id].knownBy.filter((p) => p !== action.actor) }
      }
      let s: GameState = {
        ...state,
        cards,
        lookingAt: { ...state.lookingAt, [action.actor]: state.lookingAt[action.actor].filter((p) => p !== action.target) },
      }
      const of = action.target === action.actor ? 'sa bibliothèque' : `la bibliothèque de ${state.players[action.target].name}`
      if (!action.shuffle) return log(s, action.actor, `arrête de regarder ${of}`)
      s = shuffleLibrary(s, action.target, action.seed ?? 0)
      return log(s, action.actor, `mélange ${of}`)
    }

    default:
      return state
  }
}

export { controllerOf, zoneOf }
