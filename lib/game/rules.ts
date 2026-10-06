import { isDiceRoll } from './dice'
import { EVERYONE, FORMAT_RULES, HIDDEN_ZONES, MANA_COLORS, PLAYER_ZONES, type GameAction, type GameState, type ZoneRef } from './types'

// ── Lecture ───────────────────────────────────────────────────────────────────

export function zoneOf(state: GameState, id: string): ZoneRef | null {
  for (const player of Object.values(state.players)) {
    for (const zone of PLAYER_ZONES) {
      if (player.zones[zone].includes(id)) return { player: player.id, zone }
    }
  }
  return null
}

/** Joueur dont le champ de bataille contient la carte ; hors du champ de bataille, son propriétaire. */
export function controllerOf(state: GameState, id: string): string | null {
  const where = zoneOf(state, id)
  if (!where) return null
  return where.zone === 'battlefield' ? where.player : state.cards[id].owner
}

export function isVisibleTo(state: GameState, id: string, playerId: string): boolean {
  const where = zoneOf(state, id)
  return !!state.cards[id] && !!where && isVisibleAt(state, id, where, playerId)
}

/** Même règle que isVisibleTo, quand la zone de la carte est déjà connue. */
export function isVisibleAt(state: GameState, id: string, where: ZoneRef, playerId: string): boolean {
  const card = state.cards[id]
  const viewer = state.players[playerId]
  if (viewer?.eliminated && state.options.eliminatedSeeAll) return true
  if (card.knownBy.includes(playerId) || card.knownBy.includes(EVERYONE)) return true
  if (where.zone === 'library') {
    const owner = state.players[where.player]
    return (owner.topRevealed || (owner.peekTop && owner.id === playerId)) && owner.zones.library[0] === id
  }
  if (where.zone === 'hand') return card.owner === playerId
  return !card.faceDown
}

// ── Droits ────────────────────────────────────────────────────────────────────

const MSG = {
  unknownPlayer: 'Joueur inconnu',
  eliminated: 'Tu es éliminé',
  notStarted: "La partie n'a pas commencé",
  unknownCard: 'Carte introuvable',
  hidden: 'Cette carte est cachée',
  badDestination: 'Tu ne peux déplacer cette carte que sur ton champ de bataille ou chez son propriétaire',
  notYourTurn: "Ce n'est pas ton tour",
  alreadyKept: 'Tu as déjà gardé ta main',
  notOnBattlefield: "Cette carte n'est pas sur un champ de bataille",
  notController: 'Tu ne contrôles pas cette carte',
  notOwner: "Cette carte n'est pas à toi",
  noCommanderDamage: 'Pas de blessures de commandant en Duel Commander',
  notCommander: "Ce n'est pas le commandant d'un adversaire",
  alreadyEliminated: 'Ce joueur est déjà éliminé',
  notLooking: 'Tu ne regardes pas cette bibliothèque',
  badCount: 'Nombre de cartes invalide',
  emptyLibrary: 'Bibliothèque vide',
  oneFace: "Cette carte n'a qu'une face",
  badMana: 'Mana invalide',
  badRoll: 'Lancer de dés invalide',
}

const isPlayer = (state: GameState, id: string | null) => id !== null && id in state.players

function canMove(state: GameState, action: Extract<GameAction, { type: 'move' }>): string | null {
  const card = state.cards[action.id]
  const from = zoneOf(state, action.id)
  if (!card || !from) return MSG.unknownCard
  if (!isPlayer(state, action.to.player)) return MSG.unknownPlayer

  if (HIDDEN_ZONES.includes(from.zone) && card.owner !== action.actor) {
    const looking = from.zone === 'library' && card.knownBy.includes(action.actor) && (state.lookingAt[action.actor] ?? []).includes(from.player)
    if (!looking) return MSG.hidden
  }

  const toOwnBattlefield = action.to.player === action.actor && action.to.zone === 'battlefield'
  const toOwner = action.to.player === card.owner
  const stayOnBattlefield = from.zone === 'battlefield' && action.to.zone === 'battlefield' && action.to.player === from.player
  return toOwnBattlefield || toOwner || stayOnBattlefield ? null : MSG.badDestination
}

/** null si l'action est permise, sinon un message en français. */
export function canApply(state: GameState, action: GameAction): string | null {
  if (action.type === 'start') {
    if (action.actor !== 'server' || state.started) return 'Seul le serveur démarre la partie, une seule fois'
    return action.first === undefined || isPlayer(state, action.first) ? null : MSG.unknownPlayer
  }
  const actor = state.players[action.actor]
  if (!actor) return MSG.unknownPlayer
  if (!state.started) return MSG.notStarted
  if (actor.eliminated) return MSG.eliminated

  switch (action.type) {
    case 'roll':
      return isDiceRoll(action.sides, action.count) ? null : MSG.badRoll

    case 'mana':
      return MANA_COLORS.includes(action.color) && Number.isInteger(action.delta) ? null : MSG.badMana

    case 'mulligan':
    case 'keep':
      return actor.kept ? MSG.alreadyKept : null

    case 'draw':
    case 'shuffle':
    case 'untapAll':
    case 'toggleTopRevealed':
    case 'togglePeekTop':
    case 'clearMana':
    case 'toggleKeepMana':
    case 'revealTop':
    case 'createToken':
      return null

    case 'endTurn':
      return state.activePlayer === action.actor ? null : MSG.notYourTurn

    case 'move':
      return canMove(state, action)

    case 'moveTop': {
      const top = actor.zones.library[0]
      return top ? canMove(state, { ...action, type: 'move', id: top }) : MSG.emptyLibrary
    }

    case 'giveControl': {
      const where = zoneOf(state, action.id)
      if (!where) return MSG.unknownCard
      if (where.zone !== 'battlefield') return MSG.notOnBattlefield
      if (where.player !== action.actor) return MSG.notController
      return isPlayer(state, action.to) ? null : MSG.unknownPlayer
    }

    case 'tap':
    case 'counter': {
      const where = zoneOf(state, action.id)
      if (!where) return MSG.unknownCard
      return where.zone === 'battlefield' ? null : MSG.notOnBattlefield
    }

    case 'flip':
    case 'faceDown': {
      const where = zoneOf(state, action.id)
      if (!where) return MSG.unknownCard
      if (where.zone !== 'battlefield') return MSG.notOnBattlefield
      if (where.player !== action.actor) return MSG.notController
      if (action.type === 'faceDown') return null
      const card = state.cards[action.id]
      const faces = state.catalogs[card.owner]?.entries.find((e) => e.ref === card.ref)?.en.faces
      return card.ref !== null && (faces?.length ?? 0) > 1 ? null : MSG.oneFace
    }

    case 'life':
    case 'poison':
    case 'playerCounter':
      return isPlayer(state, action.target) ? null : MSG.unknownPlayer

    case 'commanderDamage': {
      if (!FORMAT_RULES[state.format].commanderDamage) return MSG.noCommanderDamage
      if (!isPlayer(state, action.target)) return MSG.unknownPlayer
      const commander = state.cards[action.commander]
      if (!commander?.isCommander || commander.owner === action.target) return MSG.notCommander
      return null
    }

    case 'commanderTax': {
      const card = state.cards[action.id]
      if (!card?.isCommander) return MSG.unknownCard
      return card.owner === action.actor ? null : MSG.notOwner
    }

    case 'setMonarch':
    case 'setInitiative':
      return action.to === null || isPlayer(state, action.to) ? null : MSG.unknownPlayer

    case 'eliminate':
      if (!isPlayer(state, action.target)) return MSG.unknownPlayer
      return state.players[action.target].eliminated ? MSG.alreadyEliminated : null

    case 'reveal': {
      if (action.to !== 'all' && !action.to.every((p) => isPlayer(state, p))) return MSG.unknownPlayer
      if (action.ids === 'hand') return null
      return action.ids.every((id) => actor.zones.hand.includes(id)) ? null : MSG.notOwner
    }

    case 'look':
      if (!isPlayer(state, action.target)) return MSG.unknownPlayer
      return Number.isInteger(action.count) && action.count > 0 ? null : MSG.badCount

    case 'search':
      return isPlayer(state, action.target) ? null : MSG.unknownPlayer

    case 'endLook':
      return (state.lookingAt[action.actor] ?? []).includes(action.target) ? null : MSG.notLooking

    case 'reorderTop': {
      if (!(state.lookingAt[action.actor] ?? []).includes(action.target)) return MSG.notLooking
      if (action.ids.length === 0) return MSG.badCount
      // Visibilité testée d'abord, où que soit la carte : sinon le message trahirait si une carte cachée est dans la bibliothèque.
      if (!action.ids.every((id) => isVisibleTo(state, id, action.actor))) return MSG.hidden
      const library = state.players[action.target].zones.library
      return new Set(action.ids).size === action.ids.length && action.ids.every((id) => library.includes(id)) ? null : MSG.unknownCard
    }
  }
}
