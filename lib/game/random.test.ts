import { describe, it, expect } from 'vitest'
import { createRng, randomSeed, shuffle, startAction } from './random'

describe('createRng', () => {
  it('donne la même suite pour la même graine, dans [0, 1)', () => {
    for (const seed of [42, '0123456789abcdef0123456789abcdef']) {
      const a = createRng(seed)
      const b = createRng(seed)
      const values = [a(), a(), a()]
      expect([b(), b(), b()]).toEqual(values)
      for (const v of values) {
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
      }
    }
  })

  it('garde l’ancien générateur pour une graine numérique 32 bits', () => {
    expect(shuffle([...Array(10).keys()], 123456789)).toEqual([5, 9, 0, 4, 3, 7, 1, 6, 8, 2])
  })

  it('graine de 128 bits : deux graines voisines donnent des suites différentes', () => {
    const a = createRng('00000000000000000000000000000000')
    const b = createRng('00000000000000000000000000000001')
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()])
  })
})

describe('randomSeed', () => {
  it('tire 128 bits (32 chiffres hexadécimaux), différents à chaque appel', () => {
    const seeds = Array.from({ length: 20 }, () => randomSeed())
    for (const s of seeds) expect(s).toMatch(/^[0-9a-f]{32}$/)
    expect(new Set(seeds).size).toBe(20)
  })
})

describe('startAction', () => {
  it('une graine pour l’ordre du tour et une graine indépendante par joueur', () => {
    let n = 0
    const action = startAction(['p1', 'p2', 'p3'], () => `g${n++}`)
    expect(action).toEqual({ type: 'start', actor: 'server', seed: 'g0', seeds: { p1: 'g1', p2: 'g2', p3: 'g3' } })
  })
})

describe('shuffle', () => {
  const items = [...Array(60).keys()]

  it('est déterministe pour une graine', () => {
    expect(shuffle(items, 7)).toEqual(shuffle(items, 7))
    expect(shuffle(items, 'abc')).toEqual(shuffle(items, 'abc'))
  })

  it('change avec la graine', () => {
    expect(shuffle(items, 7)).not.toEqual(shuffle(items, 8))
    expect(shuffle(items, 'abc')).not.toEqual(shuffle(items, 'abd'))
  })

  it('est une permutation sans perte ni doublon', () => {
    for (const seed of [7, randomSeed()]) {
      const result = shuffle(items, seed)
      expect(result).not.toEqual(items)
      expect([...result].sort((a, b) => a - b)).toEqual(items)
    }
  })

  it('ne modifie pas le tableau d’entrée', () => {
    const copy = [...items]
    shuffle(items, 3)
    expect(items).toEqual(copy)
  })
})
