import { describe, it, expect, afterEach, vi } from 'vitest'
import { LANG_KEY, readLang, saveLang } from './lang'

function fakeStorage(initial: Record<string, string> = {}) {
  const store = { ...initial }
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
  })
  return store
}

afterEach(() => vi.unstubAllGlobals())

describe('readLang', () => {
  it('« fr » par défaut', () => {
    fakeStorage()
    expect(readLang()).toBe('fr')
  })

  it('relit « en » mémorisé, et ignore une valeur inconnue', () => {
    fakeStorage({ [LANG_KEY]: 'en' })
    expect(readLang()).toBe('en')
    fakeStorage({ [LANG_KEY]: 'de' })
    expect(readLang()).toBe('fr')
  })

  it('stockage indisponible : « fr » sans erreur', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('stockage bloqué') },
      setItem: () => { throw new Error('stockage bloqué') },
    })
    expect(readLang()).toBe('fr')
    expect(() => saveLang('en')).not.toThrow()
  })
})

describe('saveLang', () => {
  it('mémorise la langue choisie', () => {
    const store = fakeStorage()
    saveLang('en')
    expect(store[LANG_KEY]).toBe('en')
    expect(readLang()).toBe('en')
  })
})
