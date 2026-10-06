import { describe, it, expect } from 'vitest'
import { cardSrcSet } from './images'

describe('cardSrcSet', () => {
  it('propose les deux tailles quand l’image large existe', () => {
    expect(cardSrcSet('n.jpg', 'l.jpg')).toBe('n.jpg 488w, l.jpg 672w')
  })
  it('sans image large : pas de srcset', () => {
    expect(cardSrcSet('n.jpg', null)).toBeUndefined()
    expect(cardSrcSet('n.jpg', undefined)).toBeUndefined()
  })
})
