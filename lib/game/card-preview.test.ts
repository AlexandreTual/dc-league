import { describe, expect, it } from 'vitest'
import type { Catalog, VisibleCard } from './types'
import { cardRow } from '@/test/factories'
import { cardPreview } from './card-preview'

describe('cardPreview', () => {
  const catalog: Catalog = { deckId: 'd', fingerprint: 'f', entries: [{ ref: 1, en: cardRow(), fr: null, quantity: 1, isCommander: false }] }
  const visible = (over: Partial<VisibleCard> = {}): VisibleCard => ({
    hidden: false, id: 'c1', owner: 'p1', ref: 1, token: null, tapped: false, flipped: false, faceDown: false,
    x: 0, y: 0, counters: { plus: 0, minus: 0, other: 0 }, isCommander: false, ...over,
  })

  it('image de la carte visible', () => {
    expect(cardPreview(visible(), catalog, 'en')).toEqual({
      name: 'Sol Ring', image: 'https://cards.scryfall.io/normal/sol.jpg', imageLarge: 'https://cards.scryfall.io/large/sol.jpg',
    })
  })

  it('jamais pour une carte cachée, face cachée, absente ou sans image', () => {
    expect(cardPreview({ hidden: true }, catalog, 'en')).toBeNull()
    expect(cardPreview(visible({ faceDown: true }), catalog, 'en')).toBeNull()
    expect(cardPreview(undefined, catalog, 'en')).toBeNull()
    expect(cardPreview(visible({ ref: 99 }), catalog, 'en')).toBeNull()
  })
})
