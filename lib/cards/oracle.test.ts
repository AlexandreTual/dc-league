import { describe, it, expect } from 'vitest'
import { cardRow } from '@/test/factories'
import { gathererUrl, oracleFaces } from './oracle'
import type { CardFace } from './types'

const face = (overrides: Partial<CardFace>): CardFace => ({
  name: '', printed_name: null, mana_cost: null, type_line: '', printed_type_line: null,
  oracle_text: null, printed_text: null, image_normal: null, image_small: null, ...overrides,
})

describe('gathererUrl', () => {
  it('page des impressions françaises, nom anglais en slug', () => {
    expect(gathererUrl(cardRow({ name: 'Redirect Lightning' }))).toBe('https://gatherer.wizards.com/prints/redirect-lightning/fr-fr')
  })

  it('virgule, apostrophe et accents', () => {
    expect(gathererUrl(cardRow({ name: 'Kenrith, the Returned King' }))).toBe('https://gatherer.wizards.com/prints/kenrith-the-returned-king/fr-fr')
    expect(gathererUrl(cardRow({ name: 'Urza’s Saga' }))).toBe('https://gatherer.wizards.com/prints/urzas-saga/fr-fr')
    expect(gathererUrl(cardRow({ name: "Urza's Saga" }))).toBe('https://gatherer.wizards.com/prints/urzas-saga/fr-fr')
    expect(gathererUrl(cardRow({ name: 'Lim-Dûl the Necromancer' }))).toBe('https://gatherer.wizards.com/prints/lim-dul-the-necromancer/fr-fr')
  })

  it('carte double sur une seule face (Fire // Ice) : les deux noms', () => {
    const fireIce = cardRow({ name: 'Fire // Ice', faces: [face({ name: 'Fire' }), face({ name: 'Ice' })] })
    expect(gathererUrl(fireIce)).toBe('https://gatherer.wizards.com/prints/fire-ice/fr-fr')
  })

  it('carte recto verso : le nom de la face avant', () => {
    const delver = cardRow({
      name: 'Delver of Secrets // Insectile Aberration',
      faces: [face({ name: 'Delver of Secrets', image_normal: 'a.jpg' }), face({ name: 'Insectile Aberration', image_normal: 'b.jpg' })],
    })
    expect(gathererUrl(delver)).toBe('https://gatherer.wizards.com/prints/delver-of-secrets/fr-fr')
  })
})

describe('oracleFaces', () => {
  it('carte simple : Oracle anglais et texte imprimé français', () => {
    const en = cardRow({ name: 'Sol Ring', oracle_text: '{T}: Add {C}{C}.' })
    const fr = cardRow({ id: 'sol-fr', lang: 'fr', printed_name: 'Anneau solaire', printed_text: '{T} : Ajoutez {C}{C}.' })
    expect(oracleFaces(en, fr)).toEqual([
      { name: 'Sol Ring', printedName: 'Anneau solaire', typeLine: 'Artifact', oracle: '{T}: Add {C}{C}.', printed: '{T} : Ajoutez {C}{C}.' },
    ])
  })

  it('carte double : les deux faces', () => {
    const en = cardRow({
      name: 'Fire // Ice', oracle_text: null, type_line: 'Instant // Instant',
      faces: [face({ name: 'Fire', type_line: 'Instant', oracle_text: 'Fire deals 2 damage divided as you choose among one or two targets.' }),
        face({ name: 'Ice', type_line: 'Instant', oracle_text: 'Tap target permanent.\nDraw a card.' })],
    })
    const fr = cardRow({
      id: 'fire-fr', lang: 'fr', name: 'Fire // Ice',
      faces: [face({ name: 'Fire', printed_name: 'Feu', printed_text: 'Feu inflige 2 blessures…' }),
        face({ name: 'Ice', printed_name: 'Glace', printed_text: 'Engagez le permanent ciblé.' })],
    })
    expect(oracleFaces(en, fr)).toEqual([
      { name: 'Fire', printedName: 'Feu', typeLine: 'Instant', oracle: 'Fire deals 2 damage divided as you choose among one or two targets.', printed: 'Feu inflige 2 blessures…' },
      { name: 'Ice', printedName: 'Glace', typeLine: 'Instant', oracle: 'Tap target permanent.\nDraw a card.', printed: 'Engagez le permanent ciblé.' },
    ])
  })

  it('sans impression française : pas de texte imprimé', () => {
    expect(oracleFaces(cardRow(), null)).toEqual([
      { name: 'Sol Ring', printedName: null, typeLine: 'Artifact', oracle: '{T}: Add {C}{C}.', printed: null },
    ])
  })
})
