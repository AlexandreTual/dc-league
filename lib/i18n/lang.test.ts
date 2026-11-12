import { describe, expect, it } from 'vitest'
import { formatDate, isLang, pickLang } from './lang'

describe('pickLang', () => {
  it('le cookie valable l’emporte', () => {
    expect(pickLang('en', 'fr-FR,fr;q=0.9')).toBe('en')
    expect(pickLang('fr', 'en-US')).toBe('fr')
  })

  it('cookie invalide ignoré', () => {
    expect(pickLang('de', 'en-US')).toBe('en')
    expect(pickLang('', 'fr-FR')).toBe('fr')
  })

  it('navigateur : la première des deux langues préférée', () => {
    expect(pickLang(undefined, 'fr-FR,fr;q=0.9,en;q=0.8')).toBe('fr')
    expect(pickLang(undefined, 'en-US,en;q=0.9,fr;q=0.8')).toBe('en')
    expect(pickLang(undefined, 'de,fr;q=0.5')).toBe('fr')
  })

  it('poids q respectés quel que soit l’ordre', () => {
    expect(pickLang(undefined, 'en;q=0.3,fr;q=0.8')).toBe('fr')
    expect(pickLang(undefined, 'fr;q=0,en;q=0.1')).toBe('en')
  })

  it('autre langue seule : anglais ; aucun en-tête : français', () => {
    expect(pickLang(undefined, 'de-DE,de;q=0.9')).toBe('en')
    expect(pickLang(undefined, null)).toBe('fr')
    expect(pickLang(undefined, '')).toBe('fr')
  })
})

describe('isLang', () => {
  it('fr et en seulement', () => {
    expect(isLang('fr')).toBe(true)
    expect(isLang('en')).toBe(true)
    expect(isLang('EN')).toBe(false)
    expect(isLang(null)).toBe(false)
  })
})

describe('formatDate', () => {
  it('format de la langue', () => {
    const d = new Date(Date.UTC(2026, 9, 19, 12))
    expect(formatDate(d, 'fr', { day: 'numeric', month: 'long', timeZone: 'UTC' })).toBe('19 octobre')
    expect(formatDate(d, 'en', { day: 'numeric', month: 'long', timeZone: 'UTC' })).toBe('19 October')
  })
})
