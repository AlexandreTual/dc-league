import { describe, expect, it } from 'vitest'
import type { Catalog, VisibleCard } from './types'
import { cardRow } from '@/test/factories'
import { en, fr } from '@/lib/i18n/messages'
import { cardPreview } from './card-preview'

describe('cardPreview', () => {
  const catalog: Catalog = { deckId: 'd', fingerprint: 'f', entries: [{ ref: 1, en: cardRow(), fr: null, quantity: 1, isCommander: false }] }
  const visible = (over: Partial<VisibleCard> = {}): VisibleCard => ({
    hidden: false, id: 'c1', owner: 'p1', ref: 1, token: null, tapped: false, flipped: false, faceDown: false,
    x: 0, y: 0, counters: { plus: 0, minus: 0, other: 0 }, isCommander: false, ...over,
  })

  it('image de la carte visible', () => {
    expect(cardPreview(visible(), catalog, 'en', fr)).toEqual({
      name: 'Sol Ring', image: 'https://cards.scryfall.io/normal/sol.jpg', imageLarge: 'https://cards.scryfall.io/large/sol.jpg',
    })
  })

  it('capacités données et perdues en toutes lettres', () => {
    expect(cardPreview(visible({ gained: [{ keyword: 'Haste' }], lost: ['Flying'] }), catalog, 'fr', fr)?.abilities)
      .toEqual(['Capacités données : Célérité', 'Capacités perdues : Vol'])
    // Interface en anglais, cartes en français : les capacités suivent l'interface.
    expect(cardPreview(visible({ gained: [{ keyword: 'Haste', untilEndOfTurn: true }], lost: ['Flying'] }), catalog, 'fr', en)?.abilities)
      .toEqual(['Gained: Haste (this turn)', 'Lost: Flying'])
  })

  it('jamais pour une carte cachée, face cachée, absente ou sans image', () => {
    expect(cardPreview({ hidden: true }, catalog, 'en', fr)).toBeNull()
    expect(cardPreview(visible({ faceDown: true }), catalog, 'en', fr)).toBeNull()
    expect(cardPreview(undefined, catalog, 'en', fr)).toBeNull()
    expect(cardPreview(visible({ ref: 99 }), catalog, 'en', fr)).toBeNull()
  })
})
