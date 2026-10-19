import { describe, expect, it } from 'vitest'
import { boxBetween, overlaps, relativeTo } from './lasso'

describe('rectangle de sélection', () => {
  it('se trace dans n’importe quel sens', () => {
    expect(boxBetween({ x: 50, y: 40 }, { x: 10, y: 100 })).toEqual({ left: 10, top: 40, width: 40, height: 60 })
  })

  it('prend une carte dès qu’il la touche, pas celles à côté', () => {
    const box = { left: 100, top: 100, width: 50, height: 50 }
    expect(overlaps({ left: 140, top: 140, right: 200, bottom: 220 }, box)).toBe(true)
    expect(overlaps({ left: 150, top: 120, right: 210, bottom: 200 }, box)).toBe(true)
    expect(overlaps({ left: 151, top: 120, right: 210, bottom: 200 }, box)).toBe(false)
    expect(overlaps({ left: 0, top: 0, right: 99, bottom: 99 }, box)).toBe(false)
  })

  it('s’affiche relativement à sa zone', () => {
    expect(relativeTo({ left: 110, top: 220, width: 5, height: 6 }, { left: 100, top: 200 })).toEqual({ left: 10, top: 20, width: 5, height: 6 })
  })
})
