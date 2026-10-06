import { FORMAT_RULES, NO_MANA, type CardInstance, type GameSetup, type GameState, type PlayerState } from './types'

export function createInitialState(setup: GameSetup): GameState {
  const state: GameState = {
    format: setup.format,
    options: setup.options,
    catalogs: {},
    players: {},
    turnOrder: setup.players.map((p) => p.id),
    activePlayer: setup.players[0]?.id ?? '',
    turn: 1,
    started: false,
    firstTurnDone: false,
    firstChosen: false,
    monarch: null,
    initiative: null,
    cards: {},
    commanderCasts: {},
    lookingAt: {},
    nextTokenId: 1,
    log: [],
  }

  for (const p of setup.players) {
    const player: PlayerState = {
      id: p.id,
      name: p.name,
      life: FORMAT_RULES[setup.format].life,
      poison: 0,
      counters: {},
      commanderDamage: {},
      eliminated: false,
      kept: false,
      mulligans: 0,
      topRevealed: false,
      peekTop: false,
      mana: NO_MANA,
      keepMana: false,
      zones: { library: [], hand: [], battlefield: [], graveyard: [], exile: [], command: [] },
      stats: { drawn: 0, landsPlayed: 0 },
    }
    state.catalogs[p.id] = p.catalog
    state.players[p.id] = player

    for (const entry of p.catalog.entries) {
      for (let n = 1; n <= entry.quantity; n++) {
        const card: CardInstance = {
          id: `${p.id}:c${entry.ref}-${n}`,
          owner: p.id,
          ref: entry.ref,
          token: null,
          isCommander: entry.isCommander,
          tapped: false,
          flipped: false,
          faceDown: false,
          counters: { plus: 0, minus: 0, other: 0 },
          x: 50,
          y: 50,
          knownBy: [],
        }
        state.cards[card.id] = card
        player.zones[entry.isCommander ? 'command' : 'library'].push(card.id)
      }
    }
  }
  return state
}
