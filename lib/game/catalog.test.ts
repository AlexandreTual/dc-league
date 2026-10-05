import { describe, it, expect } from 'vitest'
import { cardRow, deckCardView, testDeckCards } from '@/test/factories'
import { buildCatalog, fingerprintOf } from './catalog'

describe('buildCatalog', () => {
  it('construit une entrée par ligne trouvée', () => {
    const { catalog, excluded } = buildCatalog('d1', testDeckCards())
    expect(catalog.deckId).toBe('d1')
    expect(catalog.entries.map((e) => [e.ref, e.quantity, e.isCommander])).toEqual([
      [1, 1, true],
      [2, 1, false],
      [3, 30, false],
      [4, 1, false],
    ])
    expect(catalog.entries[1].fr?.printed_name).toBe('Anneau solaire')
    expect(excluded).toEqual([])
  })

  it('exclut les cartes introuvables', () => {
    const { catalog, excluded } = buildCatalog('d1', [...testDeckCards(), deckCardView(5, null, { name: 'Sol Rnig' })])
    expect(catalog.entries).toHaveLength(4)
    expect(excluded).toEqual(['Sol Rnig'])
  })

  it('calcule une empreinte qui change avec le contenu', () => {
    const { catalog } = buildCatalog('d1', testDeckCards())
    expect(catalog.fingerprint).toBe(fingerprintOf(catalog.entries))
    const changed = testDeckCards()
    changed[2] = deckCardView(3, cardRow({ id: 'forest', name: 'Forest' }), { quantity: 29 })
    expect(buildCatalog('d1', changed).catalog.fingerprint).not.toBe(catalog.fingerprint)
  })
})
