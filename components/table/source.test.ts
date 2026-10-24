import { describe, expect, it } from 'vitest'
import { run, setupFor, start } from '@/test/game-fixtures'
import { viewFor } from '@/lib/game/view'
import { canAct, type GameSource } from './source'

const state = run(setupFor('commander', 3), start(1), { type: 'eliminate', actor: 'p2', target: 'p2' })
const online = (over: Partial<NonNullable<GameSource['online']>> = {}) =>
  ({ status: 'open', finished: false, ...over }) as NonNullable<GameSource['online']>
const source = (me: string | null, over: Partial<NonNullable<GameSource['online']>> = {}) =>
  ({ me, view: viewFor(state, me ?? 'p1'), online: online(over) })

describe('canAct (la table accepte mes gestes)', () => {
  it('vrai pour un joueur en jeu, connecté, partie en cours', () => {
    expect(canAct(source('p1'))).toBe(true)
  })

  it('vrai en mode test (pas de partie en ligne)', () => {
    expect(canAct({ me: 'p1', view: viewFor(state, 'p1') })).toBe(true)
  })

  it('faux pour un joueur éliminé', () => {
    expect(state.players.p2.eliminated).toBe(true)
    expect(canAct(source('p2'))).toBe(false)
  })

  it('faux pour un spectateur', () => {
    expect(canAct(source(null))).toBe(false)
  })

  it('faux pour une partie finie', () => {
    expect(canAct(source('p1', { finished: true }))).toBe(false)
  })

  it('faux pendant la connexion ou une reconnexion', () => {
    expect(canAct(source('p1', { status: 'connecting' }))).toBe(false)
    expect(canAct(source('p1', { status: 'reconnecting' }))).toBe(false)
    expect(canAct(source('p1', { status: 'closed' }))).toBe(false)
  })

  it('serveur plus ancien sans « eliminated » : le joueur peut agir', () => {
    const view = viewFor(state, 'p2')
    const { eliminated: _, ...p2 } = view.players.p2
    expect(canAct({ me: 'p2', view: { ...view, players: { ...view.players, p2: p2 as typeof view.players.p2 } }, online: online() })).toBe(true)
  })
})
