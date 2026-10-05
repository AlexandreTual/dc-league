import { describe, it, expect } from 'vitest'
import { placeAt, shiftCard, syncOrder } from './pile-order'

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
