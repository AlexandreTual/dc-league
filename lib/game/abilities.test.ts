import { describe, it, expect } from 'vitest'
import { abilitiesLog, abilitiesSummary, KEYWORDS, keywordLabel, nextAbilities } from './abilities'

describe('liste des capacités', () => {
  it('15 capacités, noms de Scryfall, libellés français', () => {
    expect(KEYWORDS).toHaveLength(15)
    expect(keywordLabel('Flying')).toBe('Vol')
    expect(keywordLabel('First strike')).toBe('Initiative')
    expect(keywordLabel('Hexproof')).toBe('Défense talismanique')
  })
})

describe('nextAbilities', () => {
  it('capacités ajoutées : avec la durée choisie ; déjà données : gardent la leur', () => {
    expect(nextAbilities({}, ['Trample', 'Haste'], [], true)).toEqual({ gained: [{ keyword: 'Trample', untilEndOfTurn: true }, { keyword: 'Haste', untilEndOfTurn: true }] })
    const card = { gained: [{ keyword: 'Trample' as const }] }
    expect(nextAbilities(card, ['Trample', 'Haste'], [], true)).toEqual({ gained: [{ keyword: 'Trample' }, { keyword: 'Haste', untilEndOfTurn: true }] })
  })

  it('capacité décochée : retirée ; capacités perdues : la liste voulue ; rien : champs absents', () => {
    const card = { gained: [{ keyword: 'Trample' as const }], lost: ['Flying' as const] }
    expect(nextAbilities(card, [], ['Vigilance'], false)).toEqual({ lost: ['Vigilance'] })
    expect(nextAbilities(card, [], [], false)).toEqual({})
  })

  it('doublons ignorés', () => {
    expect(nextAbilities({}, ['Haste', 'Haste'], ['Flying', 'Flying'], false)).toEqual({ gained: [{ keyword: 'Haste' }], lost: ['Flying'] })
  })
})

describe('abilitiesSummary', () => {
  it('capacités données (« ce tour » pour celles de fin de tour) et perdues, en toutes lettres ; aucune : rien', () => {
    expect(abilitiesSummary({ gained: [{ keyword: 'Trample' }, { keyword: 'Haste', untilEndOfTurn: true }], lost: ['Flying'] }))
      .toEqual(['Capacités données : Piétinement, Célérité (ce tour)', 'Capacités perdues : Vol'])
    expect(abilitiesSummary({})).toEqual([])
  })
})

describe('abilitiesLog', () => {
  it('donne, retire, rend ; durée des capacités données ; rien de changé : null', () => {
    expect(abilitiesLog('Elfes', {}, { gained: [{ keyword: 'Trample', untilEndOfTurn: true }, { keyword: 'Haste', untilEndOfTurn: true }] }))
      .toBe('donne Piétinement et Célérité à Elfes (jusqu’à la fin du tour)')
    expect(abilitiesLog('Ange', {}, { lost: ['Flying'] })).toBe('retire Vol à Ange')
    expect(abilitiesLog('Ange', { lost: ['Flying'] }, {})).toBe('rend Vol à Ange')
    expect(abilitiesLog('Elfes', { gained: [{ keyword: 'Trample' }] }, { gained: [{ keyword: 'Haste' }] }))
      .toBe('donne Célérité à Elfes ; retire Piétinement à Elfes')
    expect(abilitiesLog('Elfes', { gained: [{ keyword: 'Trample' }] }, { gained: [{ keyword: 'Trample' }] })).toBeNull()
  })

  it('trois capacités et plus : virgules', () => {
    expect(abilitiesLog('X', {}, { gained: [{ keyword: 'Flying' }, { keyword: 'Haste' }, { keyword: 'Reach' }] })).toBe('donne Vol, Célérité et Portée à X')
  })
})
