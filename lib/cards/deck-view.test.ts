import { describe, it, expect, afterEach, vi } from 'vitest'
import { DECK_VIEW_KEY, readDeckView, saveDeckView } from './deck-view'

function fakeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial }
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
  })
  return store
}

afterEach(() => vi.unstubAllGlobals())

describe('readDeckView', () => {
  it('visuels par défaut', () => {
    fakeStorage()
    expect(readDeckView()).toBe('images')
  })

  it('relit « liste » mémorisé, et ignore une valeur inconnue', () => {
    fakeStorage({ [DECK_VIEW_KEY]: 'list' })
    expect(readDeckView()).toBe('list')
    fakeStorage({ [DECK_VIEW_KEY]: 'mosaic' })
    expect(readDeckView()).toBe('images')
  })

  it('stockage indisponible : visuels, sans erreur', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('stockage bloqué') },
      setItem: () => { throw new Error('stockage bloqué') },
    })
    expect(readDeckView()).toBe('images')
    expect(() => saveDeckView('list')).not.toThrow()
  })
})

describe('saveDeckView', () => {
  it('mémorise l’affichage choisi', () => {
    const store = fakeStorage()
    saveDeckView('list')
    expect(store[DECK_VIEW_KEY]).toBe('list')
    expect(readDeckView()).toBe('list')
  })
})
