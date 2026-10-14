import { describe, it, expect } from 'vitest'
import { groupLeagues } from './list'

const l = (id: string, is_active: boolean) => ({ id, is_active })

describe('groupLeagues', () => {
  it('mes ligues en cours, puis les autres en cours, puis les terminées', () => {
    const all = [l('a', true), l('b', true), l('c', false), l('d', false)]
    expect(groupLeagues(all, new Set(['a', 'c']))).toEqual({
      mine: [l('a', true)],
      others: [l('b', true)],
      finished: [l('c', false), l('d', false)],
    })
  })
})
