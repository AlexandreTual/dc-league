import { describe, it, expect } from 'vitest'
import { card, place, run, setupFor, start } from '@/test/game-fixtures'
import { viewFor } from './view'
import { commanderPlace, frameOf, graveyardTail, lifeLevel, portraitCard } from './player-summary'

const game = () => run(setupFor('commander', 2), start(1))
const forests = (n: number) => Array.from({ length: n }, (_, i) => ({ id: card('p1', 3, i + 1), player: 'p1', zone: 'graveyard' as const }))

describe('lifeLevel', () => {
  it('rouge à 10 ou moins', () => {
    expect(lifeLevel(11)).toBe('normal')
    expect(lifeLevel(10)).toBe('low')
    expect(lifeLevel(0)).toBe('low')
    expect(lifeLevel(-3)).toBe('low')
  })
})

describe('graveyardTail', () => {
  it('les 6 dernières, la plus récente en dernier', () => {
    const view = viewFor(place(game(), forests(8)), 'p1')
    const ids = graveyardTail(view.players.p1.zones.graveyard).map((c) => c.id)
    expect(ids).toEqual([3, 4, 5, 6, 7, 8].map((n) => card('p1', 3, n)))
  })

  it('moins de 6 cartes : toutes ; cimetière vide : aucune', () => {
    const view = viewFor(place(game(), forests(2)), 'p2')
    expect(graveyardTail(view.players.p1.zones.graveyard)).toHaveLength(2)
    expect(graveyardTail(view.players.p2.zones.graveyard)).toEqual([])
  })
})

describe('portraitCard et commanderPlace', () => {
  it('le commandant en zone de commandement, vu par l’adversaire', () => {
    const view = viewFor(game(), 'p2')
    expect(portraitCard(view, 'p1')?.id).toBe(card('p1', 1))
    expect(commanderPlace(view, card('p1', 1))).toBe('zone de commandement')
  })

  it('suit le commandant sur le champ de bataille et au cimetière', () => {
    const onField = place(game(), [{ id: card('p1', 1), player: 'p1', zone: 'battlefield' }])
    expect(commanderPlace(viewFor(onField, 'p2'), card('p1', 1))).toBe('en jeu')
    const dead = place(game(), [{ id: card('p1', 1), player: 'p1', zone: 'graveyard' }])
    expect(commanderPlace(viewFor(dead, 'p2'), card('p1', 1))).toBe('au cimetière')
  })

  it('commandant invisible (mélangé dans la bibliothèque) : pas de portrait', () => {
    const view = viewFor(place(game(), [{ id: card('p1', 1), player: 'p1', zone: 'library' }]), 'p2')
    expect(portraitCard(view, 'p1')).toBeNull()
    expect(commanderPlace(view, card('p1', 1))).toBeNull()
  })
})

describe('frameOf', () => {
  it('une couleur, plusieurs, terrain, incolore', () => {
    expect(frameOf(['R'], 'Instant')).toBe('R')
    expect(frameOf(['W', 'U'], 'Creature')).toBe('multi')
    expect(frameOf([], 'Basic Land — Forest')).toBe('land')
    expect(frameOf([], 'Artifact')).toBe('colorless')
  })
})
