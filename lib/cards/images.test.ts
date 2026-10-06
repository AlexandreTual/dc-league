import { describe, it, expect } from 'vitest'
import { cardRow } from '@/test/factories'
import { cardSrcSet, sharpSource, withImagesOf } from './images'
import type { CardRow } from './types'

describe('cardSrcSet', () => {
  it('propose normal (488 px) et large (672 px) au navigateur', () => {
    expect(cardSrcSet('https://x/normal/a.jpg', 'https://x/large/a.jpg')).toBe('https://x/normal/a.jpg 488w, https://x/large/a.jpg 672w')
  })

  it("sans image large (carte importée avant, ancien serveur de jeu) : pas de srcset, l'image normale seule", () => {
    expect(cardSrcSet('https://x/normal/a.jpg', null)).toBeUndefined()
    expect(cardSrcSet('https://x/normal/a.jpg', undefined)).toBeUndefined()
  })
})

const print = (id: string, opts: Partial<CardRow> = {}) =>
  cardRow({
    id, oracle_id: 'o-sol', illustration_id: 'ill-sol', image_status: 'highres_scan',
    image_normal: `https://x/normal/${id}.jpg`, image_large: `https://x/large/${id}.jpg`, image_small: `https://x/small/${id}.jpg`,
    ...opts,
  })

describe('sharpSource', () => {
  const blurryFr = print('sol-sld-fr', { lang: 'fr', set_code: 'sld', image_status: 'placeholder', printed_name: 'Anneau solaire' })

  it('impression floue : une impression nette de même carte et même illustration', () => {
    expect(sharpSource(blurryFr, [print('sol-sld-en')])?.id).toBe('sol-sld-en')
  })

  it('préfère une impression nette dans la même langue (texte en français sur l’image)', () => {
    const frSharp = print('sol-c21-fr', { lang: 'fr' })
    expect(sharpSource(blurryFr, [print('sol-sld-en'), frSharp])?.id).toBe('sol-c21-fr')
  })

  it('lowres, placeholder et missing sont floues ; highres_scan et statut inconnu ne le sont pas', () => {
    for (const status of ['lowres', 'placeholder', 'missing']) {
      expect(sharpSource(print('a', { image_status: status }), [print('b')])?.id).toBe('b')
    }
    expect(sharpSource(print('a'), [print('b')])).toBeNull()
    expect(sharpSource(print('a', { image_status: null }), [print('b')])).toBeNull()
    expect(sharpSource(print('a', { image_status: undefined }), [print('b')])).toBeNull()
  })

  it("aucune impression nette avec la même illustration : null (on garde l'image d'origine)", () => {
    expect(sharpSource(blurryFr, [
      print('autre-illu', { illustration_id: 'ill-autre' }),
      print('aussi-floue', { image_status: 'lowres' }),
      print('autre-carte', { oracle_id: 'o-autre' }),
      print('sans-image', { image_normal: null }),
    ])).toBeNull()
    expect(sharpSource(print('sans-illu', { image_status: 'lowres', illustration_id: null }), [print('b', { illustration_id: null })])).toBeNull()
  })

  it('carte recto-verso : compare l’illustration de la face avant', () => {
    const face = (ill: string) => ({ name: 'A', printed_name: null, mana_cost: null, type_line: 'X', printed_type_line: null, oracle_text: null, printed_text: null, image_normal: 'n', image_small: 's', illustration_id: ill })
    const blurry = print('dfc-fr', { lang: 'fr', image_status: 'lowres', illustration_id: null, faces: [face('ill-front'), face('ill-back')] })
    const sharp = print('dfc-en', { illustration_id: null, faces: [face('ill-front'), face('ill-back')] })
    expect(sharpSource(blurry, [sharp])?.id).toBe('dfc-en')
  })
})

describe('withImagesOf', () => {
  it("prend seulement les images : nom, texte, langue et édition d'origine gardés", () => {
    const fr = print('sol-sld-fr', { lang: 'fr', set_code: 'sld', collector_number: '7', image_status: 'placeholder', printed_name: 'Anneau solaire', printed_text: 'Texte FR' })
    const out = withImagesOf(fr, print('sol-sld-en'))
    expect(out).toEqual({
      ...fr,
      image_normal: 'https://x/normal/sol-sld-en.jpg',
      image_large: 'https://x/large/sol-sld-en.jpg',
      image_small: 'https://x/small/sol-sld-en.jpg',
    })
  })

  it('carte recto-verso : images face par face', () => {
    const face = (img: string) => ({ name: 'A', printed_name: 'A fr', mana_cost: null, type_line: 'X', printed_type_line: null, oracle_text: null, printed_text: null, image_normal: `n-${img}`, image_large: `l-${img}`, image_small: `s-${img}` })
    const out = withImagesOf(print('a', { faces: [face('a0'), face('a1')] }), print('b', { faces: [face('b0'), face('b1')] }))
    expect(out.faces!.map((f) => [f.printed_name, f.image_normal, f.image_large, f.image_small])).toEqual([
      ['A fr', 'n-b0', 'l-b0', 's-b0'],
      ['A fr', 'n-b1', 'l-b1', 's-b1'],
    ])
  })
})
