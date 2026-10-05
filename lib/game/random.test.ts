import { describe, it, expect } from 'vitest'
import { createRng, shuffle } from './random'

describe('createRng', () => {
  it('donne la même suite pour la même graine, dans [0, 1)', () => {
    const a = createRng(42)
    const b = createRng(42)
    const values = [a(), a(), a()]
    expect([b(), b(), b()]).toEqual(values)
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('shuffle', () => {
  const items = [...Array(60).keys()]

  it('est déterministe pour une graine', () => {
    expect(shuffle(items, 7)).toEqual(shuffle(items, 7))
  })

  it('change avec la graine', () => {
    expect(shuffle(items, 7)).not.toEqual(shuffle(items, 8))
  })

  it('est une permutation sans perte ni doublon', () => {
    const result = shuffle(items, 7)
    expect(result).not.toEqual(items)
    expect([...result].sort((a, b) => a - b)).toEqual(items)
  })

  it('ne modifie pas le tableau d’entrée', () => {
    const copy = [...items]
    shuffle(items, 3)
    expect(items).toEqual(copy)
  })
})
