import { STARTING_LIFE, type Catalog, type CardInstance, type GameState } from './types'

export function createInitialState(catalog: Catalog): GameState {
  const state: GameState = {
    turn: 1,
    life: STARTING_LIFE,
    zones: { library: [], hand: [], battlefield: [], graveyard: [], exile: [], command: [] },
    cards: {},
    commanderCasts: {},
    stats: { drawn: 0, landsPlayed: 0, mulligans: 0 },
    nextTokenId: 1,
    log: [],
  }
  for (const entry of catalog.entries) {
    for (let n = 1; n <= entry.quantity; n++) {
      const card: CardInstance = {
        id: `c${entry.ref}-${n}`,
        ref: entry.ref,
        token: null,
        isCommander: entry.isCommander,
        tapped: false,
        flipped: false,
        faceDown: false,
        counters: { plus: 0, minus: 0, other: 0 },
        x: 50,
        y: 50,
      }
      state.cards[card.id] = card
      state.zones[entry.isCommander ? 'command' : 'library'].push(card.id)
    }
  }
  return state
}
