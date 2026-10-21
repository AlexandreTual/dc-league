import { describe, it, expect } from 'vitest'
import { closePileActions, placeAt, shiftCard, syncOrder } from './pile-order'

describe('ordre des cartes regardées', () => {
  it('shiftCard décale une carte d’un cran, sans sortir de la liste', () => {
    expect(shiftCard(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c'])
    expect(shiftCard(['a', 'b', 'c'], 'c', -1)).toEqual(['a', 'c', 'b'])
    expect(shiftCard(['a', 'b', 'c'], 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(shiftCard(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c'])
    expect(shiftCard(['a', 'b'], 'z', 1)).toEqual(['a', 'b'])
  })

  it('placeAt pose la carte glissée à la place de la carte visée', () => {
    expect(placeAt(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(placeAt(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(placeAt(['a', 'b', 'c'], 'b', 'b')).toEqual(['a', 'b', 'c'])
    expect(placeAt(['a', 'b', 'c'], 'z', 'a')).toEqual(['a', 'b', 'c'])
  })

  it('syncOrder garde l’ordre choisi des cartes encore là et ajoute les nouvelles à la fin', () => {
    expect(syncOrder(['c', 'a', 'b'], ['a', 'b', 'c'])).toEqual(['c', 'a', 'b'])
    expect(syncOrder(['c', 'a', 'b'], ['a', 'c'])).toEqual(['c', 'a'])
    expect(syncOrder(['b', 'a'], ['a', 'b', 'd'])).toEqual(['b', 'a', 'd'])
  })
})

describe('fermeture de la fenêtre de la bibliothèque', () => {
  const seen = ['a', 'b', 'c']

  it('recherche : ferme avec la case « Mélanger en fermant » (Échap compris)', () => {
    expect(closePileActions({ target: 'p1', mode: 'search', seen, order: null, shuffle: true }))
      .toEqual([{ type: 'endLook', target: 'p1', shuffle: true }])
    expect(closePileActions({ target: 'p1', mode: 'search', seen, order: null, shuffle: false }))
      .toEqual([{ type: 'endLook', target: 'p1', shuffle: false }])
  })

  it('regard : un ordre changé est appliqué avant la fin du regard, sans mélange', () => {
    expect(closePileActions({ target: 'p1', mode: 'look', seen, order: ['c', 'a', 'b'], shuffle: false })).toEqual([
      { type: 'reorderTop', target: 'p1', ids: ['c', 'a', 'b'] },
      { type: 'endLook', target: 'p1', shuffle: false },
    ])
  })

  it('regard : ordre inchangé, ou mélange demandé, pas de réordonnancement', () => {
    expect(closePileActions({ target: 'p1', mode: 'look', seen, order: ['a', 'b', 'c'], shuffle: false }))
      .toEqual([{ type: 'endLook', target: 'p1', shuffle: false }])
    expect(closePileActions({ target: 'p1', mode: 'look', seen, order: ['c', 'a', 'b'], shuffle: true }))
      .toEqual([{ type: 'endLook', target: 'p1', shuffle: true }])
  })

  it('regard : seules comptent les cartes encore regardées', () => {
    expect(closePileActions({ target: 'p1', mode: 'look', seen: ['a', 'c'], order: ['c', 'b', 'a'], shuffle: false })).toEqual([
      { type: 'reorderTop', target: 'p1', ids: ['c', 'a'] },
      { type: 'endLook', target: 'p1', shuffle: false },
    ])
  })

  it('consultation simple : aucune action', () => {
    expect(closePileActions({ target: 'p1', mode: 'browse', seen, order: null, shuffle: true })).toEqual([])
  })
})
