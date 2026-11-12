import { VENTURE_DUNGEONS } from '@/lib/game/dungeons'
import { MANA_COLORS, PLAYER_ZONES, type GameAction, type GameState, type PlayerZone } from '@/lib/game/types'

/** Générateur d'actions aléatoires couvrant tout le moteur (y compris moveMany, giveControl, mulligan, élimination). */
export function randomActions(rng: () => number) {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(rng() * list.length)]
  const seed = () => Math.floor(rng() * 1e9)
  return (s: GameState): GameAction => {
    const ids = s.turnOrder
    const actor = pick(ids)
    const allCards = Object.keys(s.cards)
    const anyCard = () => pick(allCards)
    const zoneCards = (p: string, z: PlayerZone) => s.players[p].zones[z]
    switch (pick([
      'mulligan', 'keep', 'draw', 'shuffle', 'endTurn', 'endTurn', 'move', 'move', 'move', 'moveTop', 'moveMany', 'moveMany',
      'giveControl', 'tap', 'untapAll', 'flip', 'rotate', 'faceDown', 'phase', 'counter', 'pt', 'ptTurn', 'effect', 'loyalty',
      'abilities', 'createToken', 'life', 'poison', 'playerCounter', 'commanderDamage', 'commanderTax', 'setMonarch',
      'setInitiative', 'venture', 'skipVenture', 'eliminate', 'reveal', 'revealTop', 'toggleTopRevealed', 'togglePeekTop',
      'mana', 'clearMana', 'toggleKeepMana', 'look', 'search', 'reorderTop', 'endLook', 'roll',
    ] as const)) {
      case 'mulligan': return { type: 'mulligan', actor, seed: seed() }
      case 'keep': return { type: 'keep', actor }
      case 'draw': return { type: 'draw', actor, count: 1 + Math.floor(rng() * 2) }
      case 'shuffle': return { type: 'shuffle', actor, seed: seed() }
      case 'endTurn': return { type: 'endTurn', actor: s.activePlayer, byHost: rng() < 0.1 }
      case 'move': {
        const id = anyCard()
        return { type: 'move', actor, id, to: { player: rng() < 0.5 ? actor : s.cards[id].owner, zone: pick(PLAYER_ZONES) }, faceDown: rng() < 0.15, position: pick(['top', 'bottom', 2] as const), x: rng() * 100, y: rng() * 100 }
      }
      case 'moveTop': return { type: 'moveTop', actor, to: { player: actor, zone: pick(PLAYER_ZONES) } }
      case 'moveMany': {
        const owner = pick(ids)
        const from = pick(['hand', 'battlefield', 'graveyard', 'exile'] as const)
        const list = zoneCards(owner, from).slice(0, 1 + Math.floor(rng() * 3))
        const zone = pick(PLAYER_ZONES)
        const random = zone !== 'battlefield' && rng() < 0.3
        return {
          type: 'moveMany', actor, ids: list, zone, position: pick(['top', 'bottom'] as const),
          places: zone === 'battlefield' && rng() < 0.5 ? list.map(() => ({ x: rng() * 100, y: rng() * 100 })) : undefined,
          random, seed: random ? seed() : undefined,
        }
      }
      case 'giveControl': return { type: 'giveControl', actor, id: pick(zoneCards(actor, 'battlefield').length ? zoneCards(actor, 'battlefield') : allCards), to: pick(ids) }
      case 'tap': return { type: 'tap', actor, id: anyCard() }
      case 'untapAll': return { type: 'untapAll', actor }
      case 'flip': return { type: 'flip', actor, id: anyCard() }
      case 'rotate': return { type: 'rotate', actor, id: anyCard() }
      case 'faceDown': return { type: 'faceDown', actor, id: anyCard() }
      case 'phase': return { type: 'phase', actor, id: anyCard() }
      case 'counter': return { type: 'counter', actor, id: anyCard(), kind: pick(['plus', 'minus', 'other'] as const), delta: pick([1, 2, -1, -3]) }
      case 'pt': return { type: 'pt', actor, id: anyCard(), power: pick([1, -2, 0]), toughness: pick([1, -1, 3]) }
      case 'ptTurn': return { type: 'ptTurn', actor, id: anyCard(), power: pick([2, -1]), toughness: pick([2, 0]) }
      case 'effect': {
        const bf = zoneCards(actor, 'battlefield')
        return { type: 'effect', actor, ids: bf.slice(0, 2), power: 1, toughness: 1, gained: rng() < 0.5 ? ['Haste'] : [], untilEndOfTurn: rng() < 0.7 }
      }
      case 'loyalty': return { type: 'loyalty', actor, id: anyCard(), delta: pick([1, -2]) }
      case 'abilities': return { type: 'abilities', actor, id: anyCard(), gained: ['Trample'], lost: rng() < 0.3 ? ['Flying'] : [], untilEndOfTurn: rng() < 0.5 }
      case 'createToken': return { type: 'createToken', actor, token: { name: 'Soldat', typeLine: 'Token Creature', power: '1', toughness: '1', colors: [], image: null }, x: rng() * 120 - 10, y: 50, copy: rng() < 0.2 }
      case 'life': return { type: 'life', actor, target: pick(ids), delta: pick([-5, -1, 3]) }
      case 'poison': return { type: 'poison', actor, target: pick(ids), delta: pick([-2, 1, 3]) }
      case 'playerCounter': return { type: 'playerCounter', actor, target: pick(ids), name: pick(['Énergie', 'toString', 'Rad']), delta: pick([-2, 1]) }
      case 'commanderDamage': {
        const commander = allCards.find((id) => s.cards[id].isCommander && s.cards[id].owner === pick(ids)) ?? anyCard()
        return { type: 'commanderDamage', actor, target: pick(ids), commander, delta: pick([-3, 2, 7]) }
      }
      case 'commanderTax': return { type: 'commanderTax', actor, id: allCards.find((id) => s.cards[id].isCommander && s.cards[id].owner === actor) ?? anyCard(), delta: pick([1, -1]) }
      case 'setMonarch': return { type: 'setMonarch', actor, to: rng() < 0.2 ? null : pick(ids) }
      case 'setInitiative': return { type: 'setInitiative', actor, to: rng() < 0.2 ? null : pick(ids) }
      case 'venture': return { type: 'venture', actor, undercity: rng() < 0.5, dungeon: pick([...VENTURE_DUNGEONS, undefined]) }
      case 'skipVenture': return { type: 'skipVenture', actor }
      // Rare : une élimination raccourcit la partie.
      case 'eliminate': return rng() < 0.3 ? { type: 'eliminate', actor, target: rng() < 0.7 ? actor : pick(ids) } : { type: 'untapAll', actor }
      case 'reveal': {
        const hand = zoneCards(actor, 'hand')
        return { type: 'reveal', actor, ids: hand.length && rng() < 0.7 ? [pick(hand)] : 'hand', to: rng() < 0.4 ? 'all' : [pick(ids)] }
      }
      case 'revealTop': return { type: 'revealTop', actor }
      case 'toggleTopRevealed': return { type: 'toggleTopRevealed', actor }
      case 'togglePeekTop': return { type: 'togglePeekTop', actor }
      case 'mana': return { type: 'mana', actor, color: pick(MANA_COLORS), delta: pick([1, 3, -2]) }
      case 'clearMana': return { type: 'clearMana', actor }
      case 'toggleKeepMana': return { type: 'toggleKeepMana', actor }
      case 'look': return { type: 'look', actor, target: pick(ids), count: 1 + Math.floor(rng() * 3) }
      case 'search': return { type: 'search', actor, target: pick(ids) }
      case 'reorderTop': {
        const target = pick(s.lookingAt[actor]?.length ? s.lookingAt[actor] : ids)
        return { type: 'reorderTop', actor, target, ids: [...zoneCards(target, 'library').slice(0, 2)].reverse() }
      }
      case 'endLook': {
        const shuffle = rng() < 0.5
        return { type: 'endLook', actor, target: pick(s.lookingAt[actor]?.length ? s.lookingAt[actor] : ids), shuffle, seed: shuffle ? seed() : undefined, keep: rng() < 0.5 ? true : undefined }
      }
      default: return { type: 'roll', actor, sides: pick([2, 6, 20]), count: 1 + Math.floor(rng() * 2), seed: seed() }
    }
  }
}
