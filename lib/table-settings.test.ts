import { describe, it, expect } from 'vitest'
import { battlefieldStyle, DEFAULT_TABLE_SETTINGS, parseTableSettings } from './table-settings'

describe('parseTableSettings', () => {
  it('rien ou illisible : réglages par défaut (quadrillage, fond actuel)', () => {
    expect(DEFAULT_TABLE_SETTINGS).toEqual({ grid: true, background: null })
    expect(parseTableSettings(null)).toEqual(DEFAULT_TABLE_SETTINGS)
    expect(parseTableSettings('pas du json')).toEqual(DEFAULT_TABLE_SETTINGS)
    expect(parseTableSettings('[1]')).toEqual(DEFAULT_TABLE_SETTINGS)
  })

  it('relit les réglages enregistrés', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: '#1E3A2F' }))).toEqual({ grid: false, background: '#1e3a2f' })
  })

  it('ignore une couleur invalide (pas d’injection CSS)', () => {
    expect(parseTableSettings(JSON.stringify({ grid: true, background: 'red; background-image: url(x)' }))).toEqual(DEFAULT_TABLE_SETTINGS)
    expect(parseTableSettings(JSON.stringify({ grid: 'non', background: '#123' }))).toEqual(DEFAULT_TABLE_SETTINGS)
  })
})

describe('battlefieldStyle', () => {
  it('par défaut : quadrillage clair discret de 24 px, fond inchangé', () => {
    const style = battlefieldStyle(DEFAULT_TABLE_SETTINGS)
    expect(style.backgroundColor).toBeUndefined()
    expect(style.backgroundSize).toBe('24px 24px')
    expect(style.backgroundImage).toContain('rgba(255, 255, 255, 0.05)')
  })

  it('sans quadrillage : aucune image de fond', () => {
    expect(battlefieldStyle({ grid: false, background: null })).toEqual({})
    expect(battlefieldStyle({ grid: false, background: '#1e3a2f' })).toEqual({ backgroundColor: '#1e3a2f' })
  })

  it('fond clair : lignes sombres pour rester visibles', () => {
    const style = battlefieldStyle({ grid: true, background: '#f0e6c8' })
    expect(style.backgroundColor).toBe('#f0e6c8')
    expect(style.backgroundImage).toContain('rgba(0, 0, 0, 0.08)')
  })
})
