import { describe, it, expect } from 'vitest'
import { battlefieldStyle, cardSize, DEFAULT_TABLE_SETTINGS, parseTableSettings } from './table-settings'

describe('parseTableSettings', () => {
  it('rien ou illisible : réglages par défaut (quadrillage, fond actuel)', () => {
    expect(DEFAULT_TABLE_SETTINGS).toEqual({ grid: true, background: null, cardScale: 1, pilesBesideHand: false })
    expect(parseTableSettings(null)).toEqual(DEFAULT_TABLE_SETTINGS)
    expect(parseTableSettings('pas du json')).toEqual(DEFAULT_TABLE_SETTINGS)
    expect(parseTableSettings('[1]')).toEqual(DEFAULT_TABLE_SETTINGS)
  })

  it('relit les réglages enregistrés', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: '#1E3A2F', cardScale: 1, pilesBesideHand: true })))
      .toEqual({ grid: false, background: '#1e3a2f', cardScale: 1, pilesBesideHand: true })
  })

  it('piles à côté de la main absent (sauvegarde d’avant) ou invalide : désactivé, sans perdre le reste', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: null, cardScale: 1.3 }))).toEqual({ grid: false, background: null, cardScale: 1.3, pilesBesideHand: false })
    expect(parseTableSettings(JSON.stringify({ grid: false, background: null, cardScale: 1, pilesBesideHand: 'oui' }))).toEqual({ grid: false, background: null, cardScale: 1, pilesBesideHand: false })
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
    expect(battlefieldStyle({ grid: false, background: null, cardScale: 1, pilesBesideHand: false })).toEqual({})
    expect(battlefieldStyle({ grid: false, background: '#1e3a2f', cardScale: 1, pilesBesideHand: false })).toEqual({ backgroundColor: '#1e3a2f' })
  })

  it('fond clair : lignes sombres pour rester visibles', () => {
    const style = battlefieldStyle({ grid: true, background: '#f0e6c8', cardScale: 1, pilesBesideHand: false })
    expect(style.backgroundColor).toBe('#f0e6c8')
    expect(style.backgroundImage).toContain('rgba(0, 0, 0, 0.08)')
  })
})

describe('taille des cartes', () => {
  it('réglage absent (sauvegarde d’avant) : 100 %, le reste est gardé', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: '#1e3a2f' }))).toEqual({ grid: false, background: '#1e3a2f', cardScale: 1, pilesBesideHand: false })
  })

  it('relit une taille proposée, ignore une valeur hors liste', () => {
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1.3 })).cardScale).toBe(1.3)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 7 })).cardScale).toBe(1)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: '1.3' })).cardScale).toBe(1)
  })

  it('cardSize : 7 % de la largeur et au moins 72 px à 100 %, multipliés par le réglage', () => {
    expect(cardSize(1)).toEqual({ width: '7%', minWidth: '72px' })
    expect(cardSize(1.5)).toEqual({ width: '10.5%', minWidth: '108px' })
    expect(cardSize(0.8)).toEqual({ width: '5.6%', minWidth: '58px' })
  })
})
