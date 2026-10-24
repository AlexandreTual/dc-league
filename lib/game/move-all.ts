// « Tout déplacer » : cartes d'une de mes zones retenues par le filtre, dans l'ordre de la zone.
import { catalogEntry } from './catalog'
import { PLAYER_ZONES, type CardInstance, type GameAction, type GameState, type MoveAllFilter } from './types'

const WORDS: Record<Exclude<MoveAllFilter, 'nonland'>, string> = {
  creature: 'Creature', land: 'Land', enchantment: 'Enchantment', artifact: 'Artifact', planeswalker: 'Planeswalker',
}

/** Libellés du journal, au singulier et au pluriel. */
export const FILTER_WORDS: Record<MoveAllFilter, [string, string]> = {
  creature: ['créature', 'créatures'],
  land: ['terrain', 'terrains'],
  nonland: ['carte non-terrain', 'cartes non-terrain'],
  enchantment: ['enchantement', 'enchantements'],
  artifact: ['artefact', 'artefacts'],
  planeswalker: ['planeswalker', 'planeswalkers'],
}

/** Mots de la ligne de type anglaise de la face visible (première face d'une carte double non retournée). */
function typeWords(state: GameState, card: CardInstance): string[] {
  // Règle 708.2 : un permanent face cachée est une créature 2/2 sans autre type.
  if (card.faceDown) return ['Creature']
  const entry = card.token ? null : catalogEntry(state.catalogs[card.owner], card.ref)?.en
  const faces = entry?.faces
  const line = card.token?.typeLine ?? (card.flipped && faces && faces.length > 1 ? faces[1].type_line : entry?.type_line) ?? ''
  return line.split(' // ')[0].split('—')[0].split(/\s+/)
}

export function matchesFilter(state: GameState, card: CardInstance, filter: MoveAllFilter): boolean {
  const words = typeWords(state, card)
  return filter === 'nonland' ? !words.includes('Land') : words.includes(WORDS[filter])
}

/** Identifiants déplacés par l'action, dans l'ordre de la zone de départ (vide si la zone n'existe pas). */
export function moveAllIds(state: GameState, action: Extract<GameAction, { type: 'moveAll' }>): string[] {
  if (!Object.hasOwn(state.players, action.from.player) || !PLAYER_ZONES.includes(action.from.zone)) return []
  const ids = state.players[action.from.player].zones[action.from.zone]
  const { filter } = action
  return filter ? ids.filter((id) => matchesFilter(state, state.cards[id], filter)) : [...ids]
}
