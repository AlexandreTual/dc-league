import { describe, it, expect } from 'vitest'
import { cardRow } from '@/test/factories'
import { playerVisual } from './visual'

// Impression demandée par le joueur : Sol Ring Secret Lair (SLD 1512), absente en français.
const en = cardRow({ id: 'sol-sld', set_code: 'sld', collector_number: '1512', image_normal: 'n/sld.jpg', image_large: 'l/sld.jpg', image_small: 's/sld.jpg' })
const frOther = cardRow({ id: 'sol-cmr-fr', lang: 'fr', printed_name: 'Anneau solaire', set_code: 'cmr', collector_number: '472', image_normal: 'n/cmr.jpg', image_large: 'l/cmr.jpg', image_small: 's/cmr.jpg' })
const asked = { set: 'SLD', number: '1512' }

describe('playerVisual', () => {
  it('française d’une autre impression : nom et texte français, images de l’impression demandée', () => {
    const shown = playerVisual(frOther, en, asked)!
    expect(shown).toMatchObject({ id: 'sol-cmr-fr', lang: 'fr', printed_name: 'Anneau solaire', image_normal: 'n/sld.jpg', image_large: 'l/sld.jpg', image_small: 's/sld.jpg' })
  })

  it('française de l’impression demandée : gardée telle quelle', () => {
    const frAsked = { ...frOther, set_code: 'sld', collector_number: '1512' }
    expect(playerVisual(frAsked, en, asked)).toBe(frAsked)
  })

  it('sans édition demandée : la française choisie à l’import', () => {
    expect(playerVisual(frOther, en, { set: null, number: null })).toBe(frOther)
  })

  it('impression anglaise différente de celle demandée (trouvée par son nom) : la française', () => {
    expect(playerVisual(frOther, { ...en, set_code: 'c21', collector_number: '263' }, asked)).toBe(frOther)
  })

  it('anglaise sans image, ou pas de française : rien ne change', () => {
    expect(playerVisual(frOther, { ...en, image_normal: null }, asked)).toBe(frOther)
    expect(playerVisual(null, en, asked)).toBeNull()
  })

  it('carte recto-verso : images de chaque face', () => {
    const face = (name: string, image: string) => ({
      name, printed_name: `${name} (FR)`, mana_cost: null, type_line: 'Creature', printed_type_line: null,
      oracle_text: null, printed_text: null, image_normal: image, image_large: image, image_small: image,
    })
    const enDfc = { ...en, faces: [face('A', 'en-a.jpg'), face('B', 'en-b.jpg')] }
    const frDfc = { ...frOther, faces: [face('A', 'fr-a.jpg'), face('B', 'fr-b.jpg')] }
    const shown = playerVisual(frDfc, enDfc, asked)!
    expect(shown.faces!.map((f) => [f.printed_name, f.image_normal])).toEqual([['A (FR)', 'en-a.jpg'], ['B (FR)', 'en-b.jpg']])
  })
})
