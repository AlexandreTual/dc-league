import { describe, it, expect } from 'vitest'
import { legacyTarget } from './legacy'

describe('legacyTarget', () => {
  it('pages de la ligue : même page de la ligue mise en avant', () => {
    expect(legacyTarget('classement', 'l1')).toBe('/ligues/l1/classement')
    expect(legacyTarget('calendar', 'l1')).toBe('/ligues/l1/calendrier')
    expect(legacyTarget('playoffs', 'l1')).toBe('/ligues/l1/playoffs')
  })

  it('sans ligue mise en avant : la liste des ligues', () => {
    expect(legacyTarget('classement', null)).toBe('/ligues')
    expect(legacyTarget('calendar', null)).toBe('/ligues')
  })
})
