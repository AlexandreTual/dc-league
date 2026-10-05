import { describe, it, expect } from 'vitest'
import { card, run, setupFor, start } from '@/test/game-fixtures'
import { applyAction } from './apply'
import { playerBadges } from './player-badges'
import { viewFor } from './view'
import type { GameAction, GameState } from './types'

const apply = (s: GameState, ...actions: GameAction[]) => actions.reduce((acc, a) => applyAction(acc, a), s)
const game = () => run(setupFor('commander', 3), start(1))
const name = (id: string) => (id === card('p2', 1) ? 'Kenrith' : '?')
const badges = (s: GameState) => playerBadges(viewFor(s, 'p1'), 'p1', name)

describe('playerBadges', () => {
  it('aucun badge quand tout est à zéro', () => {
    expect(badges(game())).toEqual([])
  })

  it('poison, plus forte blessure de commandant, compteurs, monarque, initiative, dans cet ordre', () => {
    const s = apply(game(),
      { type: 'poison', actor: 'p2', target: 'p1', delta: 2 },
      { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: card('p2', 1), delta: 6 },
      { type: 'playerCounter', actor: 'p1', target: 'p1', name: 'Expérience', delta: 2 },
      { type: 'setMonarch', actor: 'p1', to: 'p1' },
      { type: 'setInitiative', actor: 'p1', to: 'p1' })
    expect(badges(s)).toEqual([
      { key: 'poison', label: '☠ 2', level: 'normal' },
      { key: 'commander', label: '⚔ Kenrith 6', level: 'normal' },
      { key: 'counter:Expérience', label: 'Expérience 2', level: 'normal' },
      { key: 'monarch', label: '👑 Monarque', level: 'normal' },
      { key: 'initiative', label: 'Initiative', level: 'normal' },
    ])
  })

  it('en alerte près du seuil, mortel au seuil', () => {
    const near = apply(game(), { type: 'poison', actor: 'p2', target: 'p1', delta: 8 },
      { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: card('p2', 1), delta: 18 })
    expect(badges(near).map((b) => b.level)).toEqual(['warn', 'warn'])
    const dead = apply(near, { type: 'poison', actor: 'p2', target: 'p1', delta: 2 },
      { type: 'commanderDamage', actor: 'p2', target: 'p1', commander: card('p2', 1), delta: 3 })
    expect(badges(dead).map((b) => b.level)).toEqual(['lethal', 'lethal'])
  })

  it('un compteur libre revenu à zéro disparaît', () => {
    const s = apply(game(), { type: 'playerCounter', actor: 'p1', target: 'p1', name: 'Énergie', delta: 1 },
      { type: 'playerCounter', actor: 'p1', target: 'p1', name: 'Énergie', delta: -1 })
    expect(badges(s)).toEqual([])
  })
})
