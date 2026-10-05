import { describe, it, expect } from 'vitest'
import { GIVE_UP_AFTER_MS, RETRY_DELAYS, SOCKET_MSG, nextStep } from './reconnect'

const lost = { reason: '', tableGone: false }

describe('nextStep', () => {
  it('réessaie avec des délais croissants, le dernier se répète', () => {
    expect([0, 1, 2, 3, 4, 9].map((a) => nextStep(lost, 0, a, 1000))).toEqual(
      [...RETRY_DELAYS, RETRY_DELAYS.at(-1)].map((retryIn) => ({ retryIn })),
    )
  })

  it('arrête après une minute sans connexion', () => {
    expect(nextStep(lost, 0, 3, GIVE_UP_AFTER_MS - 1)).toHaveProperty('retryIn')
    expect(nextStep(lost, 0, 3, GIVE_UP_AFTER_MS)).toEqual({ giveUp: SOCKET_MSG.unreachable })
  })

  it('arrête aussitôt si la partie est supprimée ou introuvable', () => {
    expect(nextStep({ reason: 'Table supprimée', tableGone: false }, 0, 0, 0)).toEqual({ giveUp: "Cette partie n'existe plus" })
    expect(nextStep({ reason: 'Partie introuvable', tableGone: false }, 0, 0, 0)).toEqual({ giveUp: "Cette partie n'existe plus" })
    expect(nextStep({ reason: '', tableGone: true }, 0, 0, 0)).toEqual({ giveUp: "Cette partie n'existe plus" })
  })
})
