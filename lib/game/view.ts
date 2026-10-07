import { isVisibleAt } from './rules'
import { PLAYER_ZONES, type CardView, type GameState, type PlayerView, type PlayerViewState, type VisibleCard, type ZoneRef } from './types'

const HIDDEN: CardView = { hidden: true }

/** Lignes du journal envoyées dans une vue ; le journal complet reste dans l'état (et le stockage). */
export const VIEW_LOG_LIMIT = 200

function visibleCard(state: GameState, id: string): VisibleCard {
  const c = state.cards[id]
  return {
    hidden: false, id: c.id, owner: c.owner, ref: c.ref, token: c.token, isCommander: c.isCommander,
    tapped: c.tapped, flipped: c.flipped, faceDown: c.faceDown, counters: c.counters, x: c.x, y: c.y,
  }
}

/** Ce que voit `playerId` : une carte qu'il ne voit pas devient `{ hidden: true }`, sans autre information. */
export function viewFor(state: GameState, playerId: string, canUndo = false): PlayerView {
  const cardView = (id: string, where: ZoneRef): CardView => (isVisibleAt(state, id, where, playerId) ? visibleCard(state, id) : HIDDEN)

  const players: Record<string, PlayerViewState> = {}
  for (const player of Object.values(state.players)) {
    const zones = {} as PlayerViewState['zones']
    for (const zone of PLAYER_ZONES) {
      const where = { player: player.id, zone }
      const ids = player.zones[zone]
      if (zone === 'library') {
        const visible = ids.flatMap((id, index) => (isVisibleAt(state, id, where, playerId) ? [{ index, card: visibleCard(state, id) }] : []))
        zones.library = { count: ids.length, visible }
      } else {
        zones[zone] = ids.map((id) => cardView(id, where))
      }
    }
    const { zones: _, ...rest } = player
    players[player.id] = { ...rest, zones }
  }

  const log = state.log.filter((l) => l.visibleTo === 'all' || l.visibleTo.includes(playerId))
  const logStart = Math.max(0, log.length - VIEW_LOG_LIMIT)

  return {
    me: playerId,
    format: state.format,
    turn: state.turn,
    activePlayer: state.activePlayer,
    turnOrder: state.turnOrder,
    firstChosen: state.firstChosen,
    monarch: state.monarch,
    initiative: state.initiative,
    players,
    commanderCasts: state.commanderCasts,
    lookingAt: state.lookingAt[playerId] ?? [],
    log: log.slice(logStart).map(({ turn, actor, text, roll }) => (roll ? { turn, actor, text, roll } : { turn, actor, text })),
    logStart,
    canUndo,
  }
}
