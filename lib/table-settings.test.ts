import { describe, it, expect } from 'vitest'
import { ALL_EFFECTS, battlefieldStyle, CARD_EFFECTS, cardSize, DEFAULT_TABLE_SETTINGS, GRAVEYARD_ARTS, NO_EFFECTS, parseTableSettings } from './table-settings'

describe('parseTableSettings', () => {
  it('rien ou illisible : réglages par défaut (quadrillage, fond actuel)', () => {
    expect(DEFAULT_TABLE_SETTINGS).toEqual({ grid: true, background: null, cardScale: 1, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36 })
    expect(parseTableSettings(null)).toEqual(DEFAULT_TABLE_SETTINGS)
    expect(parseTableSettings('pas du json')).toEqual(DEFAULT_TABLE_SETTINGS)
    expect(parseTableSettings('[1]')).toEqual(DEFAULT_TABLE_SETTINGS)
  })

  it('relit les réglages enregistrés', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: '#1E3A2F', cardScale: 1, pilesBesideHand: true })))
      .toEqual({ grid: false, background: '#1e3a2f', cardScale: 1, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36 })
  })

  it('piles à côté de la main absent (sauvegarde d’avant) ou invalide : activé (par défaut), sans perdre le reste', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: null, cardScale: 1.3 }))).toEqual({ grid: false, background: null, cardScale: 1.3, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36 })
    expect(parseTableSettings(JSON.stringify({ grid: false, background: null, cardScale: 1, pilesBesideHand: 'oui' }))).toEqual({ grid: false, background: null, cardScale: 1, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36 })
  })

  it('ancienne disposition choisie (piles dans la colonne) : gardée', () => {
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, pilesBesideHand: false, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36 })).pilesBesideHand).toBe(false)
  })

  it('animations des cartes absentes (sauvegarde d’avant) ou invalides : toutes activées', () => {
    expect(ALL_EFFECTS).toEqual({ legendary: true, commander: true, flying: true })
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1 })).cardEffects).toEqual(ALL_EFFECTS)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, cardEffects: 'non' })).cardEffects).toEqual(ALL_EFFECTS)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, cardEffects: [false] })).cardEffects).toEqual(ALL_EFFECTS)
  })

  it('ancienne case unique « Animations des cartes » : reprise pour chaque animation', () => {
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, cardEffects: false })).cardEffects).toEqual(NO_EFFECTS)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, cardEffects: true })).cardEffects).toEqual(ALL_EFFECTS)
  })

  it('chaque animation activée ou non ; une animation absente ou illisible : activée', () => {
    const fx = (cardEffects: unknown) => parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, cardEffects })).cardEffects
    expect(fx({ legendary: true, commander: true, flying: false })).toEqual({ legendary: true, commander: true, flying: false })
    expect(fx({ legendary: false, commander: true, flying: true })).toEqual({ legendary: false, commander: true, flying: true })
    expect(fx({ commander: false })).toEqual({ legendary: true, commander: false, flying: true })
    expect(fx({ legendary: 'non', commander: false, flying: 0 })).toEqual({ legendary: true, commander: false, flying: true })
  })

  it('fenêtre « Animations » : légendaires, entrée du commandant, vol', () => {
    expect(CARD_EFFECTS.map((e) => e.id)).toEqual(['legendary', 'commander', 'flying'])
    expect(CARD_EFFECTS.map((e) => e.label)).toEqual(['Légendaires', 'Entrée du commandant', 'Vol'])
  })

  it('capacités sur les cartes : symboles par défaut (absent, sauvegarde d’avant, ou illisible), libellés gardés', () => {
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1 })).abilityStyle).toBe('icons')
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, abilityStyle: 'gros' })).abilityStyle).toBe('icons')
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, abilityStyle: 'labels' })).abilityStyle).toBe('labels')
  })

  it('illustration du cimetière en liste : 36 px par défaut (absent, sauvegarde d’avant, ou hors liste), taille choisie gardée', () => {
    expect(GRAVEYARD_ARTS).toEqual([16, 36, 60, 90])
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1 })).graveyardArt).toBe(36)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, graveyardArt: 500 })).graveyardArt).toBe(36)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, graveyardArt: '60' })).graveyardArt).toBe(36)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, graveyardArt: 90 })).graveyardArt).toBe(90)
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
    expect(battlefieldStyle({ grid: false, background: null, cardScale: 1, pilesBesideHand: false, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36 })).toEqual({})
    expect(battlefieldStyle({ grid: false, background: '#1e3a2f', cardScale: 1, pilesBesideHand: false, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36 })).toEqual({ backgroundColor: '#1e3a2f' })
  })

  it('fond clair : lignes sombres pour rester visibles', () => {
    const style = battlefieldStyle({ grid: true, background: '#f0e6c8', cardScale: 1, pilesBesideHand: false, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36 })
    expect(style.backgroundColor).toBe('#f0e6c8')
    expect(style.backgroundImage).toContain('rgba(0, 0, 0, 0.08)')
  })
})

describe('taille des cartes', () => {
  it('réglage absent (sauvegarde d’avant) : 100 %, le reste est gardé', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: '#1e3a2f' }))).toEqual({ grid: false, background: '#1e3a2f', cardScale: 1, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36 })
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
