import { describe, it, expect } from 'vitest'
import { cardSrcSet } from './images'

describe('cardSrcSet', () => {
  it('propose normal (488 px) et large (672 px) au navigateur', () => {
    expect(cardSrcSet('https://x/normal/a.jpg', 'https://x/large/a.jpg')).toBe('https://x/normal/a.jpg 488w, https://x/large/a.jpg 672w')
  })

  it("sans image large (carte importée avant, ancien serveur de jeu) : pas de srcset, l'image normale seule", () => {
    expect(cardSrcSet('https://x/normal/a.jpg', null)).toBeUndefined()
    expect(cardSrcSet('https://x/normal/a.jpg', undefined)).toBeUndefined()
  })
})
