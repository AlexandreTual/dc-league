import { describe, it, expect } from 'vitest'
import { cardRow } from '@/test/factories'
import { gathererUrl, oracleFaces } from './oracle'
import type { CardFace, CardRow } from './types'

const face = (overrides: Partial<CardFace>): CardFace => ({
  name: '', printed_name: null, mana_cost: null, type_line: '', printed_type_line: null,
  oracle_text: null, printed_text: null, image_normal: null, image_small: null, ...overrides,
})

describe('gathererUrl', () => {
  const fr = (overrides: Partial<CardRow>) => cardRow({ id: 'fr', lang: 'fr', ...overrides })

  it('fiche de l’impression française : édition, numéro et nom anglais en slug', () => {
    const en = cardRow({ name: 'Viscera Seer', set_code: 'm11', collector_number: '120' })
    expect(gathererUrl(en, fr({ name: 'Viscera Seer', set_code: 'soc', collector_number: '229' })))
      .toBe('https://gatherer.wizards.com/SOC/fr-fr/229/viscera-seer')
  })

  it('sans impression française : fiche anglaise', () => {
    expect(gathererUrl(cardRow({ name: 'Sol Ring', set_code: 'c21', collector_number: '263' }), null))
      .toBe('https://gatherer.wizards.com/C21/en-us/263/sol-ring')
  })

  it('virgule, apostrophe et accents', () => {
    const url = (name: string) => gathererUrl(cardRow({ name, set_code: 'x', collector_number: '1' }))
    expect(url('Kenrith, the Returned King')).toBe('https://gatherer.wizards.com/X/en-us/1/kenrith-the-returned-king')
    expect(url('Urza\u2019s Saga')).toBe('https://gatherer.wizards.com/X/en-us/1/urzas-saga')
    expect(url("Urza's Saga")).toBe('https://gatherer.wizards.com/X/en-us/1/urzas-saga')
    expect(url('Lim-Dûl the Necromancer')).toBe('https://gatherer.wizards.com/X/en-us/1/lim-dul-the-necromancer')
  })

  it('numéro avec caractère spécial : encodé', () => {
    expect(gathererUrl(cardRow({ name: 'Sol Ring', set_code: 'plst', collector_number: 'C21-263★' })))
      .toBe('https://gatherer.wizards.com/PLST/en-us/C21-263%E2%98%85/sol-ring')
  })

  it('carte double sur une seule face (Fire // Ice) : les deux noms', () => {
    const fireIce = cardRow({ name: 'Fire // Ice', set_code: 'mh2', collector_number: '290', faces: [face({ name: 'Fire' }), face({ name: 'Ice' })] })
    expect(gathererUrl(fireIce)).toBe('https://gatherer.wizards.com/MH2/en-us/290/fire-ice')
  })

  it('carte recto verso : le nom de la face avant', () => {
    const delver = cardRow({
      name: 'Delver of Secrets // Insectile Aberration', set_code: 'isd', collector_number: '51',
      faces: [face({ name: 'Delver of Secrets', image_normal: 'a.jpg' }), face({ name: 'Insectile Aberration', image_normal: 'b.jpg' })],
    })
    expect(gathererUrl(delver)).toBe('https://gatherer.wizards.com/ISD/en-us/51/delver-of-secrets')
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
