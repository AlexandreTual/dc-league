import { describe, it, expect } from 'vitest'
import { ALL_EFFECTS, battlefieldStyle, CARD_EFFECTS, cardSize, DEFAULT_TABLE_SETTINGS, GRAVEYARD_ARTS, HAND_SCALES, handRowStyle, NO_EFFECTS, parseTableSettings } from './table-settings'

describe('parseTableSettings', () => {
  it('rien ou illisible : réglages par défaut (quadrillage, fond actuel)', () => {
    expect(DEFAULT_TABLE_SETTINGS).toEqual({ grid: true, background: null, cardScale: 1, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36, handScale: 1 })
    expect(parseTableSettings(null)).toEqual(DEFAULT_TABLE_SETTINGS)
    expect(parseTableSettings('pas du json')).toEqual(DEFAULT_TABLE_SETTINGS)
    expect(parseTableSettings('[1]')).toEqual(DEFAULT_TABLE_SETTINGS)
  })

  it('relit les réglages enregistrés', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: '#1E3A2F', cardScale: 1, pilesBesideHand: true })))
      .toEqual({ grid: false, background: '#1e3a2f', cardScale: 1, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36, handScale: 1 })
  })

  it('piles à côté de la main absent (sauvegarde d’avant) ou invalide : activé (par défaut), sans perdre le reste', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: null, cardScale: 1.3 }))).toEqual({ grid: false, background: null, cardScale: 1.3, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36, handScale: 1 })
    expect(parseTableSettings(JSON.stringify({ grid: false, background: null, cardScale: 1, pilesBesideHand: 'oui' }))).toEqual({ grid: false, background: null, cardScale: 1, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36, handScale: 1 })
  })

  it('ancienne disposition choisie (piles dans la colonne) : gardée', () => {
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1, pilesBesideHand: false, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36, handScale: 1 })).pilesBesideHand).toBe(false)
  })

  it('animations des cartes absentes (sauvegarde d’avant) ou invalides : toutes activées', () => {
    expect(ALL_EFFECTS).toEqual({ legendary: true, commander: true, graveyard: true, flying: true, life: true, crowns: true, dungeon: true, elimination: true, dice: true })
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
    expect(fx({ legendary: true, commander: true, flying: false })).toEqual({ ...ALL_EFFECTS, flying: false })
    expect(fx({ legendary: false, commander: true, flying: true })).toEqual({ ...ALL_EFFECTS, legendary: false })
    expect(fx({ commander: false })).toEqual({ ...ALL_EFFECTS, commander: false })
    expect(fx({ legendary: 'non', commander: false, flying: 0 })).toEqual({ ...ALL_EFFECTS, commander: false })
    // Réglage enregistré avant le retour du cimetière et les animations des joueurs : ils sont activés.
    expect(fx({ legendary: false, commander: false, flying: false })).toEqual({ ...NO_EFFECTS, graveyard: true, life: true, crowns: true, dungeon: true, elimination: true, dice: true })
    expect(fx({ ...ALL_EFFECTS, dice: false, life: false })).toEqual({ ...ALL_EFFECTS, dice: false, life: false })
  })

  it('fenêtre « Animations » : cartes (légendaires, entrée du commandant, vol), puis joueurs et partie', () => {
    expect(CARD_EFFECTS.filter((e) => e.group === 'cards').map((e) => e.label)).toEqual(['Légendaires', 'Entrée du commandant', 'Retour du cimetière', 'Vol'])
    expect(CARD_EFFECTS.filter((e) => e.group === 'players').map((e) => e.id)).toEqual(['life', 'crowns', 'dungeon', 'elimination', 'dice'])
    expect(CARD_EFFECTS.filter((e) => e.group === 'players').map((e) => e.label))
      .toEqual(['Vie, poison et blessures', 'Monarque et initiative', 'Donjon', 'Élimination et victoire', 'Dés'])
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
    expect(battlefieldStyle({ grid: false, background: null, cardScale: 1, pilesBesideHand: false, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36, handScale: 1 })).toEqual({})
    expect(battlefieldStyle({ grid: false, background: '#1e3a2f', cardScale: 1, pilesBesideHand: false, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36, handScale: 1 })).toEqual({ backgroundColor: '#1e3a2f' })
  })

  it('fond clair : lignes sombres pour rester visibles', () => {
    const style = battlefieldStyle({ grid: true, background: '#f0e6c8', cardScale: 1, pilesBesideHand: false, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36, handScale: 1 })
    expect(style.backgroundColor).toBe('#f0e6c8')
    expect(style.backgroundImage).toContain('rgba(0, 0, 0, 0.08)')
  })
})

describe('taille des cartes', () => {
  it('réglage absent (sauvegarde d’avant) : 100 %, le reste est gardé', () => {
    expect(parseTableSettings(JSON.stringify({ grid: false, background: '#1e3a2f' }))).toEqual({ grid: false, background: '#1e3a2f', cardScale: 1, pilesBesideHand: true, cardEffects: ALL_EFFECTS, abilityStyle: 'icons', graveyardArt: 36, handScale: 1 })
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

describe('taille de la main', () => {
  it('propose de 60 % à 140 %, 100 % par défaut', () => {
    expect(HAND_SCALES).toEqual([0.6, 0.8, 1, 1.2, 1.4])
    expect(DEFAULT_TABLE_SETTINGS.handScale).toBe(1)
  })

  it('relit une taille proposée ; absente ou hors liste : 100 %, sans perdre les autres réglages', () => {
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1.3, handScale: 0.6 }))).toMatchObject({ cardScale: 1.3, handScale: 0.6 })
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, cardScale: 1.3 }))).toMatchObject({ cardScale: 1.3, handScale: 1 })
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, handScale: 3 })).handScale).toBe(1)
    expect(parseTableSettings(JSON.stringify({ grid: true, background: null, handScale: '0.8' })).handScale).toBe(1)
  })

  it('handRowStyle : le réglage passé à la bande main + piles en variable CSS', () => {
    expect(handRowStyle(1)).toEqual({ '--hand-scale': '1' })
    expect(handRowStyle(0.6)).toEqual({ '--hand-scale': '0.6' })
  })
})
