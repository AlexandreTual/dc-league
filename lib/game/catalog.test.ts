import { describe, it, expect } from 'vitest'
import { cardRow, deckCardView, testDeckCards } from '@/test/factories'
import { buildCatalog, catalogEntry, fingerprintOf } from './catalog'

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

describe('catalogEntry', () => {
  it('retrouve une entrée par sa référence, comme une recherche dans la liste', () => {
    const { catalog } = buildCatalog('d1', testDeckCards())
    for (const entry of catalog.entries) expect(catalogEntry(catalog, entry.ref)).toBe(entry)
    expect(catalogEntry(catalog, 99)).toBeUndefined()
  })

  it('rend rien sans catalogue ni référence (carte cachée, jeton)', () => {
    const { catalog } = buildCatalog('d1', testDeckCards())
    expect(catalogEntry(undefined, 1)).toBeUndefined()
    expect(catalogEntry(catalog, null)).toBeUndefined()
  })

  it('garde la première entrée d’une référence en double, comme find', () => {
    const { catalog } = buildCatalog('d1', testDeckCards())
    const twin = { ...catalog.entries[1], ref: catalog.entries[0].ref }
    const doubled = { ...catalog, entries: [catalog.entries[0], twin] }
    expect(catalogEntry(doubled, catalog.entries[0].ref)).toBe(catalog.entries[0])
  })

  it('indexe une seule fois un même catalogue', () => {
    const { catalog } = buildCatalog('d1', testDeckCards())
    let reads = 0
    const entries = new Proxy(catalog.entries, {
      get(target, key, receiver) {
        if (key === Symbol.iterator || key === 'forEach') reads++
        return Reflect.get(target, key, receiver)
      },
    })
    const watched = { ...catalog, entries }
    for (let i = 0; i < 50; i++) catalogEntry(watched, 2)
    expect(reads).toBe(1)
    expect(catalogEntry(watched, 2)?.fr?.printed_name).toBe('Anneau solaire')
  })

  it('suit un catalogue complété après une première lecture', () => {
    const { catalog } = buildCatalog('d1', testDeckCards())
    const entries = catalog.entries.slice(0, 1)
    const growing = { ...catalog, entries }
    expect(catalogEntry(growing, 2)).toBeUndefined()
    entries.push(catalog.entries[1])
    expect(catalogEntry(growing, 2)).toBe(catalog.entries[1])
  })
})
