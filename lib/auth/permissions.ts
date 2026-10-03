import type { CurrentUser } from './types'

type Actor = Pick<CurrentUser, 'isAdmin' | 'playerId'>

export function canCreateDeckFor(user: Actor, playerId: string): boolean {
  return user.isAdmin || user.playerId === playerId
}

export function canEditDeck(user: Actor, deck: { player_id: string }): boolean {
  return canCreateDeckFor(user, deck.player_id)
}
