import { describe, it, expect } from 'vitest'
import { cardRow } from '@/test/factories'
import { cardInfo } from './apply'
import type { Catalog } from './types'

const face = (name: string, normal: string, large?: string) => ({
  name, printed_name: null, mana_cost: null, type_line: 'Creature', printed_type_line: null,
  oracle_text: null, printed_text: null, image_normal: normal, image_small: normal,
  ...(large ? { image_large: large } : {}),
})

const catalog = (en: ReturnType<typeof cardRow>, fr: ReturnType<typeof cardRow> | null = null): Catalog => ({
  deckId: 'd', fingerprint: 'f', entries: [{ ref: 1, en, fr, quantity: 1, isCommander: false }],
})
const at = (flipped = false) => ({ ref: 1, token: null, flipped, faceDown: false })

describe('cardInfo : image large', () => {
  it("donne l'image large de l'impression affichée (française si elle existe)", () => {
    const c = catalog(cardRow(), cardRow({ id: 'sol-fr', lang: 'fr', image_large: 'https://x/large/sol-fr.jpg' }))
    expect(cardInfo(c, at(), 'fr').imageLarge).toBe('https://x/large/sol-fr.jpg')
    expect(cardInfo(c, at(), 'en').imageLarge).toBe('https://cards.scryfall.io/large/sol.jpg')
  })

  it('carte retournée : image large de la face arrière', () => {
    const c = catalog(cardRow({
      faces: [face('Delver of Secrets', 'front.jpg', 'front-l.jpg'), face('Insectile Aberration', 'back.jpg', 'back-l.jpg')],
    }))
    expect(cardInfo(c, at(true), 'en')).toMatchObject({ image: 'back.jpg', imageLarge: 'back-l.jpg' })
  })

  it('catalogue ancien (sans image large, serveur de jeu pas encore redéployé) : null, sans erreur', () => {
    const { image_large: _, ...old } = cardRow()
    const c = catalog(old as ReturnType<typeof cardRow>)
    expect(cardInfo(c, at(), 'en')).toMatchObject({ image: 'https://cards.scryfall.io/normal/sol.jpg', imageLarge: null })
    const dfc = catalog(cardRow({ faces: [face('A', 'a.jpg'), face('B', 'b.jpg')] }))
    expect(cardInfo(dfc, at(true), 'en').imageLarge).toBeNull()
  })

  it('jeton : pas d’image large', () => {
    const token = { name: 'Soldat', typeLine: 'Token', power: '1', toughness: '1', colors: [], image: 't.jpg' }
    expect(cardInfo(catalog(cardRow()), { ref: null, token, flipped: false, faceDown: false }, 'fr').imageLarge).toBeNull()
  })
})
