import { describe, expect, it } from 'vitest'
import { loadFailed } from './load'

describe('loadFailed', () => {
  it("renvoie false quand aucune requête n'a échoué", () => {
    expect(loadFailed({ data: [], error: null }, { data: 0 })).toBe(false)
  })

  it("renvoie true dès qu'une requête D1 a échoué", () => {
    expect(loadFailed({ data: [], error: null }, { data: null, error: 'D1_ERROR' })).toBe(true)
  })
})
