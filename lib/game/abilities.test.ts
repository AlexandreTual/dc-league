import { describe, it, expect } from 'vitest'
import { abilitiesLog, abilitiesSummary, abilityText, isValidParam, KEYWORD_GROUPS, KEYWORDS, keywordLabel, nextAbilities, takesParam } from './abilities'

describe('liste des capacités', () => {
  it('43 capacités, noms de Scryfall, libellés français, chacune dans un seul groupe', () => {
    expect(KEYWORDS).toHaveLength(43)
    expect(KEYWORD_GROUPS.flatMap((g) => g.keywords)).toEqual([...KEYWORDS])
    expect(keywordLabel('Annihilator')).toBe('Annihilateur')
    expect(keywordLabel('Forestwalk')).toBe('Traversée des forêts')
    expect(keywordLabel('Undying')).toBe('Immortalité')
    expect(keywordLabel('Ward')).toBe('Parade')
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

describe('capacités à paramètre', () => {
  it('Protection, Parade et les capacités chiffrées en prennent un, les autres non', () => {
    expect(takesParam('Protection') && takesParam('Ward') && takesParam('Annihilator') && takesParam('Toxic')).toBe(true)
    expect(takesParam('Flying') || takesParam('Forestwalk') || takesParam('Persist')).toBe(false)
  })

  it('capacités chiffrées : un nombre de 1 à 99 ; texte, journal, aperçu', () => {
    for (const ok of ['1', '2', '10', '99']) expect(isValidParam('Annihilator', ok)).toBe(true)
    for (const ko of ['', '0', '01', '100', '-1', '2.5', 'X', ' 2', undefined]) expect(isValidParam('Toxic', ko)).toBe(false)
    expect(isValidParam('Prowess', '1')).toBe(false)
    expect(abilityText({ keyword: 'Annihilator', param: '2' })).toBe('Annihilateur 2')
    expect(abilitiesLog('Ulamog', {}, { gained: [{ keyword: 'Annihilator', param: '2' }, { keyword: 'Toxic', param: '1' }] }))
      .toBe('donne Annihilateur 2 et Toxique 1 à Ulamog')
    expect(abilitiesLog('Ulamog', { gained: [{ keyword: 'Annihilator', param: '2' }] }, { gained: [{ keyword: 'Annihilator', param: '4' }] }))
      .toBe('change Annihilateur de Ulamog : 4')
    expect(abilitiesSummary({ gained: [{ keyword: 'Afterlife', param: '3' }, { keyword: 'Forestwalk' }] }))
      .toEqual(['Capacités données : Après-vie 3, Traversée des forêts'])
  })

  it('Protection : « all » ou des couleurs WUBRG dans l’ordre, sans doublon ; Parade : un coût de 1 à 40 caractères', () => {
    for (const ok of ['all', 'R', 'R,G', 'W,U,B,R,G']) expect(isValidParam('Protection', ok)).toBe(true)
    for (const ko of ['', 'G,R', 'R,R', 'rouge', 'all,R', undefined]) expect(isValidParam('Protection', ko)).toBe(false)
    expect(isValidParam('Ward', '{2}')).toBe(true)
    expect(isValidParam('Ward', '— Payez 3 points de vie')).toBe(true)
    for (const ko of ['', '   ', 'x'.repeat(41), 'a\nb', undefined]) expect(isValidParam('Ward', ko)).toBe(false)
    expect(isValidParam('Flying', undefined)).toBe(true)
    expect(isValidParam('Flying', '{2}')).toBe(false)
  })

  it('texte affiché', () => {
    expect(abilityText({ keyword: 'Protection', param: 'R,G' })).toBe('Protection contre le rouge et le vert')
    expect(abilityText({ keyword: 'Protection', param: 'W,U,B' })).toBe('Protection contre le blanc, le bleu et le noir')
    expect(abilityText({ keyword: 'Protection', param: 'all' })).toBe('Protection contre tout')
    expect(abilityText({ keyword: 'Ward', param: '{2}' })).toBe('Parade {2}')
    expect(abilityText({ keyword: 'Ward', param: '— Payez 3 points de vie' })).toBe('Parade — Payez 3 points de vie')
    expect(abilityText({ keyword: 'Protection' })).toBe('Protection')
    expect(abilityText({ keyword: 'Haste' })).toBe('Célérité')
  })

  it('état voulu : paramètre donné, puis changé (durée gardée)', () => {
    const first = nextAbilities({}, [{ keyword: 'Protection', param: 'R' }, 'Haste'], [], true)
    expect(first).toEqual({ gained: [{ keyword: 'Protection', param: 'R', untilEndOfTurn: true }, { keyword: 'Haste', untilEndOfTurn: true }] })
    expect(nextAbilities(first, [{ keyword: 'Protection', param: 'U' }, 'Haste'], [], false))
      .toEqual({ gained: [{ keyword: 'Protection', param: 'U', untilEndOfTurn: true }, { keyword: 'Haste', untilEndOfTurn: true }] })
  })

  it('journal et aperçu avec le paramètre ; paramètre changé : « change »', () => {
    expect(abilitiesLog('Elfes', {}, { gained: [{ keyword: 'Protection', param: 'R' }, { keyword: 'Ward', param: '{2}' }] }))
      .toBe('donne Protection contre le rouge et Parade {2} à Elfes')
    expect(abilitiesLog('Elfes', { gained: [{ keyword: 'Protection', param: 'R' }] }, { gained: [{ keyword: 'Protection', param: 'U' }] }))
      .toBe('change Protection de Elfes : contre le bleu')
    expect(abilitiesLog('Elfes', { gained: [{ keyword: 'Ward', param: '{2}' }] }, { gained: [{ keyword: 'Ward', param: '{3}' }] }))
      .toBe('change Parade de Elfes : {3}')
    expect(abilitiesSummary({ gained: [{ keyword: 'Protection', param: 'all', untilEndOfTurn: true }] }))
      .toEqual(['Capacités données : Protection contre tout (ce tour)'])
  })
})
