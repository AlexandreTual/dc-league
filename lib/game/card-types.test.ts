import { describe, it, expect } from 'vitest'
import { card, run, setupFor, start } from '@/test/game-fixtures'
import { cardTypes, countByType, filterPile } from './card-types'
import type { GameState, TokenData, VisibleCard } from './types'

const visible = (s: GameState, id: string, patch: Partial<VisibleCard> = {}): VisibleCard => {
  const c = s.cards[id]
  return { hidden: false, id, owner: c.owner, ref: c.ref, token: c.token, isCommander: c.isCommander, tapped: c.tapped, flipped: c.flipped,
    faceDown: c.faceDown, counters: c.counters, x: c.x, y: c.y, ...patch }
}
const soldier: TokenData = { name: 'Soldat', typeLine: 'Token Creature — Soldier', power: '1', toughness: '1', colors: ['W'], image: null }

function pile() {
  const s = run(setupFor('commander', 1), start(1), { type: 'createToken', actor: 'p1', token: soldier, x: 0, y: 0 })
  // Kenrith (créature), Anneau solaire (artefact), Forêt (terrain), Delver (créature), jeton Soldat (créature)
  const cards = [card('p1', 1), card('p1', 2), card('p1', 3), card('p1', 3, 2), card('p1', 4), 't1'].map((id) => visible(s, id))
  return { s, cards }
}
const names = (cards: VisibleCard[]) => cards.map((c) => c.id)

describe('cardTypes', () => {
  it.each([
    ['Legendary Creature — Human Noble', ['creature']],
    ['Artifact Creature — Golem', ['creature', 'artifact']],
    ['Land Creature — Forest Dryad', ['creature', 'land']],
    ['Basic Land — Forest', ['land']],
    ['Legendary Enchantment Artifact', ['artifact', 'enchantment']],
    ['Instant — Adventure', ['instant']],
    ['Sorcery', ['sorcery']],
    ['Legendary Planeswalker — Jace', ['planeswalker']],
    ['Battle — Siege', ['battle']],
    ['Kindred Instant — Elf', ['instant']],
    ['Token Creature — Soldier', ['creature']],
    ['', []],
  ])('%s', (typeLine, expected) => {
    expect(cardTypes({ typeLine })).toEqual(expected)
  })

  it('carte double face : seulement la face visible', () => {
    expect(cardTypes({ typeLine: 'Creature — Human Wizard // Land' })).toEqual(['creature'])
  })
})

describe('filterPile et countByType', () => {
  it('comptes par type, dans l’ordre des boutons, seulement les types présents', () => {
    const { s, cards } = pile()
    expect(countByType(cards, s.catalogs)).toEqual([
      { type: 'creature', label: 'Créature', count: 3 },
      { type: 'land', label: 'Terrain', count: 2 },
      { type: 'artifact', label: 'Artefact', count: 1 },
    ])
  })

  it('sans filtre : toute la pile', () => {
    const { s, cards } = pile()
    expect(filterPile(cards, { text: '', types: [] }, s.catalogs)).toEqual(cards)
  })

  it('un filtre : seulement ce type (jeton compris)', () => {
    const { s, cards } = pile()
    expect(names(filterPile(cards, { text: '', types: ['creature'] }, s.catalogs))).toEqual([card('p1', 1), card('p1', 4), 't1'])
  })

  it('plusieurs filtres : « ou »', () => {
    const { s, cards } = pile()
    expect(names(filterPile(cards, { text: '', types: ['artifact', 'land'] }, s.catalogs)))
      .toEqual([card('p1', 2), card('p1', 3), card('p1', 3, 2)])
  })

  it('avec le texte : « et », nom français ou anglais', () => {
    const { s, cards } = pile()
    expect(names(filterPile(cards, { text: 'anneau', types: ['artifact'] }, s.catalogs))).toEqual([card('p1', 2)])
    expect(names(filterPile(cards, { text: 'sol', types: ['creature'] }, s.catalogs))).toEqual(['t1'])
    expect(filterPile(cards, { text: 'anneau', types: ['creature'] }, s.catalogs)).toEqual([])
  })

  it('carte transformée : type de la face arrière', () => {
    const { s } = pile()
    const delver = visible(s, card('p1', 4), { flipped: true })
    expect(filterPile([delver], { text: '', types: ['creature'] }, s.catalogs)).toEqual([delver])
    expect(countByType([delver], s.catalogs)).toEqual([{ type: 'creature', label: 'Créature', count: 1 }])
  })
})
