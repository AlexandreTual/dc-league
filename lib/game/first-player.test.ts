import { describe, it, expect } from 'vitest'
import { run, setupFor } from '@/test/game-fixtures'
import { drawSequence } from './first-player'
import { startAction } from './random'
import { createRoom } from './room'
import { canApply } from './rules'
import { createInitialState } from './setup'
import { viewFor } from './view'

const setup = setupFor('commander', 4)
const ids = ['p1', 'p2', 'p3', 'p4']

describe('premier joueur choisi par l’hôte', () => {
  it('il commence, les autres places restent tirées au hasard, et le journal le dit', () => {
    for (const seed of [1, 2, 3, 'abc']) {
      const s = run(setup, { type: 'start', actor: 'server', seed, first: 'p3' })
      expect(s.turnOrder[0]).toBe('p3')
      expect(s.activePlayer).toBe('p3')
      expect([...s.turnOrder].sort()).toEqual(ids)
      expect(s.firstChosen).toBe(true)
      expect(s.log.at(-1)!.text).toBe('Début de partie : Chloé commence (choisi par l\'hôte)')
    }
    const orders = new Set([1, 2, 3, 4, 5, 6].map((seed) => run(setup, { type: 'start', actor: 'server', seed, first: 'p3' }).turnOrder.join()))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('sans choix : tirage au sort, comme avant', () => {
    const s = run(setup, { type: 'start', actor: 'server', seed: 1 })
    expect(s.firstChosen).toBe(false)
    expect(s.log.at(-1)!.text).toBe(`Début de partie : ${s.players[s.turnOrder[0]].name} commence`)
  })

  it('refuse un premier joueur qui n’est pas à la table', () => {
    expect(canApply(createInitialState(setup), { type: 'start', actor: 'server', seed: 1, first: 'p9' })).toBe('Joueur inconnu')
  })

  it('la vue dit si le premier joueur a été choisi', () => {
    expect(viewFor(run(setup, { type: 'start', actor: 'server', seed: 1, first: 'p2' }), 'p1').firstChosen).toBe(true)
    expect(viewFor(run(setup, { type: 'start', actor: 'server', seed: 1 }), 'p1').firstChosen).toBe(false)
  })

  it('startAction et createRoom transmettent le choix ; un joueur absent de la table est ignoré', () => {
    expect(startAction(ids, () => 's', 'p2')).toMatchObject({ type: 'start', first: 'p2' })
    expect(startAction(ids, () => 's')).not.toHaveProperty('first')
    expect(createRoom('t', setup, 'p1', () => 's', 0, 'p4').history.state.turnOrder[0]).toBe('p4')
    const ignored = createRoom('t', setup, 'p1', () => 's', 0, 'p9')
    expect(ignored.history.state.started).toBe(true)
    expect(ignored.history.state.firstChosen).toBe(false)
  })
})

describe('drawSequence', () => {
  it('fait défiler les joueurs dans l’ordre et s’arrête sur le premier, en ralentissant', () => {
    for (const first of ids) {
      const steps = drawSequence(ids, first)
      expect(steps.at(-1)!.id).toBe(first)
      for (let i = 1; i < steps.length; i++) {
        expect(ids.indexOf(steps[i].id)).toBe((ids.indexOf(steps[i - 1].id) + 1) % ids.length)
        expect(steps[i].delay).toBeGreaterThanOrEqual(steps[i - 1].delay)
      }
      expect(steps.length).toBeGreaterThanOrEqual(2 * ids.length)
      const total = steps.reduce((t, s) => t + s.delay, 0)
      expect(total).toBeGreaterThan(1500)
      expect(total).toBeLessThan(4000)
    }
  })
})
