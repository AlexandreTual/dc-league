import { describe, it, expect } from 'vitest'
import { parseClientAction } from './validate'

const soldier = { name: 'Soldat', typeLine: 'Token Creature — Soldat', power: '1', toughness: '1', colors: ['W'], image: null }
const ok = (raw: unknown) => {
  const parsed = parseClientAction(raw)
  expect(typeof parsed, JSON.stringify(raw)).toBe('object')
  return parsed
}
const ko = (raw: unknown) => expect(typeof parseClientAction(raw), JSON.stringify(raw)).toBe('string')

describe('parseClientAction', () => {
  it('accepte les actions bien formées', () => {
    ok({ type: 'keep' })
    ok({ type: 'draw', count: 1 })
    ok({ type: 'life', target: 'p2', delta: -5 })
    ok({ type: 'move', id: 'p1:c2-1', to: { player: 'p1', zone: 'battlefield' }, x: 12.5, y: 40, faceDown: true })
    ok({ type: 'move', id: 'p1:c2-1', to: { player: 'p1', zone: 'library' }, position: 'bottom' })
    ok({ type: 'moveTop', to: { player: 'p1', zone: 'library' }, position: 3 })
    ok({ type: 'createToken', token: soldier, x: 50, y: 50 })
    ok({ type: 'createToken', token: { ...soldier, image: 'https://cards.scryfall.io/normal/front/a.jpg', copy: true }, x: 50, y: 50, copy: true })
    ok({ type: 'reveal', ids: 'hand', to: 'all' })
    ok({ type: 'reveal', ids: ['p1:c2-1'], to: ['p2', 'p3'] })
    ok({ type: 'setMonarch', to: null })
    ok({ type: 'mana', color: 'G', delta: 1 })
    ok({ type: 'counter', id: 'x', kind: 'plus', delta: 1 })
    ok({ type: 'playerCounter', target: 'p1', name: 'Énergie', delta: 2 })
    ok({ type: 'endLook', target: 'p2', shuffle: true })
    ok({ type: 'reorderTop', target: 'p2', ids: ['a', 'b'] })
  })

  it('ne garde que les champs connus (auteur, graine, byHost et le reste disparaissent)', () => {
    expect(parseClientAction({ type: 'endTurn', byHost: true, actor: 'p2', seed: 1, junk: 'x'.repeat(100) })).toEqual({ type: 'endTurn' })
    expect(parseClientAction({ type: 'createToken', token: { ...soldier, extra: 1 }, x: 1, y: 2 }))
      .toEqual({ type: 'createToken', token: soldier, x: 1, y: 2 })
  })

  it('refuse un message sans action ou d’un type inconnu', () => {
    for (const raw of [undefined, null, 'draw', 42, [], {}, { type: 'start' }, { type: 'toString' }, { type: 'nope' }]) ko(raw)
  })

  it('refuse les nombres mal typés ou hors bornes', () => {
    ko({ type: 'life', target: 'p2', delta: '5' })
    ko({ type: 'life', target: 'p2', delta: 1.5 })
    ko({ type: 'life', target: 'p2', delta: 1e9 })
    ko({ type: 'life', target: 'p2' })
    ko({ type: 'draw', count: 'deux' })
    ko({ type: 'draw', count: 0 })
    ko({ type: 'draw', count: Infinity })
    ko({ type: 'look', target: 'p2', count: -1 })
    ko({ type: 'move', id: 'a', to: { player: 'p1', zone: 'battlefield' }, x: 'gauche' })
    ko({ type: 'move', id: 'a', to: { player: 'p1', zone: 'battlefield' }, x: NaN })
    ko({ type: 'move', id: 'a', to: { player: 'p1', zone: 'library' }, position: 'milieu' })
    ko({ type: 'mana', color: 'X', delta: 1 })
    ko({ type: 'counter', id: 'x', kind: 'autre', delta: 1 })
  })

  it('refuse les chaînes absentes, vides ou trop longues', () => {
    ko({ type: 'tap' })
    ko({ type: 'tap', id: '' })
    ko({ type: 'tap', id: 'x'.repeat(201) })
    ko({ type: 'move', id: 'a', to: { player: 'p1', zone: 'ailleurs' } })
    ko({ type: 'move', id: 'a', to: 'p1' })
    ko({ type: 'playerCounter', target: 'p1', name: 'x'.repeat(41), delta: 1 })
    ko({ type: 'reveal', ids: [], to: 'all' })
    ko({ type: 'reveal', ids: 'hand', to: 'tous' })
    ko({ type: 'endLook', target: 'p2', shuffle: 'oui' })
  })

  it('jeton : type obligatoire, image Scryfall ou rien', () => {
    const { typeLine: _t, ...noType } = soldier
    ko({ type: 'createToken', token: noType, x: 50, y: 50 })
    ko({ type: 'createToken', token: { ...soldier, name: '' }, x: 50, y: 50 })
    ko({ type: 'createToken', token: { ...soldier, colors: 'W' }, x: 50, y: 50 })
    ko({ type: 'createToken', token: { ...soldier, image: 'https://pistage.example/pixel.gif' }, x: 50, y: 50 })
    ko({ type: 'createToken', token: { ...soldier, image: 'http://cards.scryfall.io/a.jpg' }, x: 50, y: 50 })
    ko({ type: 'createToken', token: { ...soldier, image: 'https://cards.scryfall.io.example.com/a.jpg' }, x: 50, y: 50 })
    ko({ type: 'createToken', token: soldier })
  })

  it('messages d’erreur en français', () => {
    expect(parseClientAction({ type: 'life', target: 'p2', delta: '5' })).toBe('Action invalide : delta')
    expect(parseClientAction(undefined)).toBe('Action invalide')
    expect(parseClientAction({ type: 'nope' })).toBe('Action inconnue')
  })
})
