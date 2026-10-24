import { describe, expect, it } from 'vitest'
import type { Catalog } from '@/lib/game/types'
import { cardLabel, dragAnnouncements, dragInstructions, isMenuKey } from './a11y'
import { en } from '@/lib/i18n/messages'

const catalog = {
  entries: [{ ref: 1, en: { name: 'Sol Ring', image_normal: null, type_line: 'Artifact' }, fr: { name: 'Anneau solaire', image_normal: null, type_line: 'Artefact' } }],
} as unknown as Catalog

const card = { ref: 1, token: null, flipped: false, faceDown: false }

describe('cardLabel', () => {
  it('donne le nom de la carte dans la langue choisie', () => {
    expect(cardLabel(catalog, card, 'fr')).toBe('Anneau solaire')
    expect(cardLabel(catalog, card, 'en')).toBe('Sol Ring')
  })

  it('ne nomme pas une carte face cachée ni une carte inconnue', () => {
    expect(cardLabel(catalog, { ...card, faceDown: true }, 'fr')).toBe('Carte face cachée')
    expect(cardLabel(catalog, { ...card, ref: null }, 'fr')).toBe('Carte face cachée')
  })
})

describe('isMenuKey', () => {
  it('Entrée, Maj+F10 et la touche Menu ouvrent le menu', () => {
    expect(isMenuKey({ key: 'Enter', shiftKey: false })).toBe(true)
    expect(isMenuKey({ key: 'F10', shiftKey: true })).toBe(true)
    expect(isMenuKey({ key: 'ContextMenu', shiftKey: false })).toBe(true)
  })

  it('les autres touches non', () => {
    expect(isMenuKey({ key: 'F10', shiftKey: false })).toBe(false)
    expect(isMenuKey({ key: ' ', shiftKey: false })).toBe(false)
    expect(isMenuKey({ key: 't', shiftKey: false })).toBe(false)
  })
})

describe('dragAnnouncements', () => {
  const names: Record<string, string> = { c1: 'Anneau solaire' }
  const players: Record<string, string> = { p1: 'Ana', p2: 'Bastien' }
  const a = dragAnnouncements({ me: 'p1', cardName: (id) => names[id], playerName: (id) => players[id] })
  const active = (card: string) => ({ id: `tile:${card}`, data: { current: { card } } }) as never
  const over = (data: unknown) => ({ id: 'x', data: { current: data } }) as never

  it('cite le nom de la carte et la zone, en français', () => {
    expect(a.onDragStart({ active: active('c1') })).toBe('Carte « Anneau solaire » saisie.')
    expect(a.onDragOver({ active: active('c1'), over: over({ player: 'p1', zone: 'battlefield' }) })).toBe('« Anneau solaire » au-dessus de : champ de bataille.')
    expect(a.onDragEnd({ active: active('c1'), over: over({ player: 'p2', zone: 'graveyard' }) })).toBe('« Anneau solaire » déposée : cimetière de Bastien.')
    expect(a.onDragCancel({ active: active('c1'), over: null })).toBe('Déplacement de « Anneau solaire » annulé.')
  })

  it('hors d’une zone, dans la fenêtre d’une pile, carte du dessus de la bibliothèque', () => {
    expect(a.onDragOver({ active: active('c1'), over: null })).toBe('« Anneau solaire » hors d’une zone.')
    expect(a.onDragEnd({ active: active('c1'), over: null })).toBe('« Anneau solaire » relâchée hors d’une zone.')
    expect(a.onDragOver({ active: active('c1'), over: over({ panel: true }) })).toBe('« Anneau solaire » au-dessus de : la fenêtre de la pile.')
    expect(a.onDragOver({ active: active('c1'), over: over({ slot: 'c2' }) })).toBe('« Anneau solaire » au-dessus de : une place de la pile.')
    expect(a.onDragStart({ active: { id: 'top:p1', data: { current: { card: 'top:p1' } } } as never })).toBe('Carte « Carte du dessus de la bibliothèque » saisie.')
  })

  it('les consignes sont en français', () => {
    expect(dragInstructions().draggable).toMatch(/Entrée/)
    expect(dragInstructions().draggable).not.toMatch(/press|space bar/i)
  })

  it('en anglais avec le dictionnaire anglais', () => {
    const b = dragAnnouncements({ me: 'p1', cardName: (id) => names[id], playerName: (id) => players[id], t: en })
    expect(b.onDragEnd({ active: active('c1'), over: over({ player: 'p2', zone: 'graveyard' }) })).toBe('"Anneau solaire" dropped: Bastien\'s graveyard.')
    expect(b.onDragOver({ active: active('c1'), over: null })).toBe('"Anneau solaire" outside any zone.')
    expect(dragInstructions(en).draggable).toMatch(/^Enter/)
    expect(cardLabel(catalog, { ...card, faceDown: true }, 'fr', en)).toBe('Face-down card')
  })
})
