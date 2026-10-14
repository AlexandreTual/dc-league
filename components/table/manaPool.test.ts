import { describe, expect, it } from 'vitest'
import { NO_MANA } from '@/lib/game/types'
import { boardColors, clickDelta, detailPosition, manaTotal } from './manaPool'

describe('réserve de mana sur le champ de bataille', () => {
  const pool = { ...NO_MANA, U: 2, G: 1 }

  it('ma réserve : les 6 couleurs, même à 0, dans l’ordre W U B R G C', () => {
    expect(boardColors(NO_MANA, true)).toEqual(['W', 'U', 'B', 'R', 'G', 'C'])
    expect(boardColors(pool, true)).toEqual(['W', 'U', 'B', 'R', 'G', 'C'])
  })

  it('réserve d’un adversaire : seulement les couleurs non nulles', () => {
    expect(boardColors(pool, false)).toEqual(['U', 'G'])
    expect(boardColors(NO_MANA, false)).toEqual([])
  })

  it('serveur plus ancien (réserve absente) : rien', () => {
    expect(boardColors(undefined, true)).toEqual([])
    expect(manaTotal(undefined)).toBe(0)
  })

  it('total de la réserve', () => {
    expect(manaTotal(pool)).toBe(3)
  })

  it('clic : +1 ; Maj+clic : +5', () => {
    expect(clickDelta({ shiftKey: false })).toBe(1)
    expect(clickDelta({ shiftKey: true })).toBe(5)
  })

  it('détail ouvert au-dessus de la réserve, gardé dans l’écran', () => {
    const screen = { width: 1000, height: 800 }
    expect(detailPosition({ left: 20, top: 700 }, screen)).toEqual({ left: 20, bottom: 104 })
    // Trop à droite : décalé pour tenir dans l'écran (détail de 240 px, marge de 8 px).
    expect(detailPosition({ left: 900, top: 700 }, screen)).toEqual({ left: 752, bottom: 104 })
    expect(detailPosition({ left: -5, top: 700 }, screen).left).toBe(8)
  })
})
