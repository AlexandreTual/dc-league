import { describe, it, expect } from 'vitest'
import { card, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { addPops, expirePops, playerChanges, POP_MERGE_MS, POP_MS } from './player-fx'
import { viewFor } from './view'
import type { GameAction, GameState } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const game = () => run(setupFor('commander', 3), start(1))
const changes = (before: GameState, after: GameState) => playerChanges(viewFor(before, 'p1'), viewFor(after, 'p1'))

describe('playerChanges', () => {
  it('rien au premier affichage', () => {
    expect(playerChanges(null, viewFor(game(), 'p1'))).toEqual({ players: [], holders: [] })
  })

  it('rien quand rien ne change', () => {
    const s = game()
    expect(changes(s, s)).toEqual({ players: [], holders: [] })
  })

  it('écart de vie, de poison et de blessures de commandant (toutes sources additionnées, la vie les compte aussi)', () => {
    const s = game()
    const t = apply(s,
      { type: 'life', actor: 'p2', target: 'p1', delta: -3 },
      { type: 'life', actor: 'p3', target: 'p2', delta: 2 },
      { type: 'poison', actor: 'p2', target: 'p3', delta: 1 },
      { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: card('p2', 1), delta: 4 },
      { type: 'commanderDamage', actor: 'p3', target: 'p1', commander: card('p3', 1), delta: 1 })
    expect(changes(s, t).players).toEqual([
      { kind: 'life', player: 'p1', delta: -8 },
      { kind: 'commander', player: 'p1', delta: 5 },
      { kind: 'life', player: 'p2', delta: 2 },
      { kind: 'poison', player: 'p3', delta: 1 },
    ])
  })

  it('joueur qui vient d’être éliminé ; pas celui déjà éliminé', () => {
    const s = game()
    const t = apply(s, { type: 'eliminate', actor: 'p2', target: 'p2' })
    expect(changes(s, t).players).toContainEqual({ kind: 'eliminated', player: 'p2' })
    expect(changes(t, t).players).toEqual([])
  })

  it('monarque et initiative : d’un joueur à un autre, de personne, à personne', () => {
    const s = game()
    const a = apply(s, { type: 'setMonarch', actor: 'p1', to: 'p1' })
    expect(changes(s, a).holders).toEqual([{ kind: 'monarch', from: null, to: 'p1' }])
    const b = apply(a, { type: 'setMonarch', actor: 'p2', to: 'p2' }, { type: 'setInitiative', actor: 'p2', to: 'p3' })
    expect(changes(a, b).holders).toEqual([{ kind: 'monarch', from: 'p1', to: 'p2' }, { kind: 'initiative', from: null, to: 'p3' }])
    const c = apply(b, { type: 'setInitiative', actor: 'p3', to: null })
    expect(changes(b, c).holders).toEqual([{ kind: 'initiative', from: 'p3', to: null }])
  })
})

describe('addPops', () => {
  it('nouvel écart : une bulle par joueur et par type', () => {
    const { pops } = addPops({}, [{ kind: 'life', player: 'p1', delta: -1 }, { kind: 'poison', player: 'p1', delta: 1 }], 1000, 0)
    expect(pops).toEqual({ 'p1:life': { delta: -1, key: 1, at: 1000 }, 'p1:poison': { delta: 1, key: 2, at: 1000 } })
  })

  it('clics rapprochés : les écarts s’additionnent et la bulle repart', () => {
    let state = addPops({}, [{ kind: 'life', player: 'p1', delta: -1 }], 1000, 0)
    state = addPops(state.pops, [{ kind: 'life', player: 'p1', delta: -1 }], 1000 + POP_MERGE_MS - 1, state.key)
    state = addPops(state.pops, [{ kind: 'life', player: 'p1', delta: -1 }], 1000 + 2 * POP_MERGE_MS - 2, state.key)
    expect(state.pops['p1:life']).toEqual({ delta: -3, key: 3, at: 1000 + 2 * POP_MERGE_MS - 2 })
  })

  it('écart trop tard : on repart de zéro', () => {
    let state = addPops({}, [{ kind: 'life', player: 'p1', delta: -1 }], 1000, 0)
    state = addPops(state.pops, [{ kind: 'life', player: 'p1', delta: 2 }], 1000 + POP_MERGE_MS, state.key)
    expect(state.pops['p1:life'].delta).toBe(2)
  })

  it('total nul : la bulle disparaît', () => {
    let state = addPops({}, [{ kind: 'life', player: 'p1', delta: -1 }], 1000, 0)
    state = addPops(state.pops, [{ kind: 'life', player: 'p1', delta: 1 }], 1100, state.key)
    expect(state.pops).toEqual({})
  })

  it('élimination ignorée (pas de bulle)', () => {
    expect(addPops({}, [{ kind: 'eliminated', player: 'p1' }], 1000, 0).pops).toEqual({})
  })
})

describe('expirePops', () => {
  it('retire les bulles finies, garde les autres (même objet si rien ne change)', () => {
    const pops = { 'p1:life': { delta: -1, key: 1, at: 1000 }, 'p2:life': { delta: 2, key: 2, at: 2000 } }
    expect(expirePops(pops, 1000 + POP_MS)).toEqual({ 'p2:life': { delta: 2, key: 2, at: 2000 } })
    expect(expirePops(pops, 1500)).toBe(pops)
  })
})
