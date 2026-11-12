import { describe, it, expect, vi } from 'vitest'
import { canShare, leagueShareText, shareOrCopy, tableShareText } from './share'
import { en } from './i18n/messages'

describe('tableShareText', () => {
  it('donne le format, le nombre de places et l’hôte', () => {
    expect(tableShareText({ format: 'commander', seats: 4, hostName: 'Ana' })).toBe('Table Commander à 4 de Ana, rejoins-moi')
    expect(tableShareText({ format: 'duel', seats: 2, hostName: 'Bastien' })).toBe('Table Duel Commander à 2 de Bastien, rejoins-moi')
  })

  it('reste lisible quand un champ manque', () => {
    expect(tableShareText({ format: 'commander', seats: 3 })).toBe('Table Commander à 3, rejoins-moi')
    expect(tableShareText({ hostName: '  ' })).toBe('Table Commander, rejoins-moi')
  })
})

describe('leagueShareText', () => {
  it('nomme la ligue', () => {
    expect(leagueShareText('Saison e2e')).toBe('Rejoins la ligue Saison e2e')
  })

  it('sans nom', () => {
    expect(leagueShareText(undefined)).toBe('Rejoins ma ligue Commander')
    expect(leagueShareText(' ')).toBe('Rejoins ma ligue Commander')
  })
})

describe('canShare', () => {
  it('vrai seulement si navigator.share est une fonction', () => {
    expect(canShare({ share: async () => {} })).toBe(true)
    expect(canShare({})).toBe(false)
    expect(canShare(undefined)).toBe(false)
  })
})

describe('shareOrCopy', () => {
  const data = { title: 'Titre', text: 'Texte', url: 'https://exemple.fr/t' }

  it('partage si navigator.share existe', async () => {
    const share = vi.fn(async () => {})
    const writeText = vi.fn(async () => {})
    expect(await shareOrCopy({ share, clipboard: { writeText } }, data)).toBe('shared')
    expect(share).toHaveBeenCalledWith(data)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('partage annulé ou échoué : rien ne se passe', async () => {
    const abort = Object.assign(new Error('annulé'), { name: 'AbortError' })
    const writeText = vi.fn(async () => {})
    expect(await shareOrCopy({ share: async () => { throw abort }, clipboard: { writeText } }, data)).toBe('cancelled')
    expect(await shareOrCopy({ share: async () => { throw new Error('refus') }, clipboard: { writeText } }, data)).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('sans navigator.share, copie le lien', async () => {
    const writeText = vi.fn(async () => {})
    expect(await shareOrCopy({ clipboard: { writeText } }, data)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(data.url)
  })

  it('copie impossible', async () => {
    expect(await shareOrCopy({ clipboard: { writeText: async () => { throw new Error('non') } } }, data)).toBe('failed')
    expect(await shareOrCopy({}, data)).toBe('failed')
    expect(await shareOrCopy(undefined, data)).toBe('failed')
  })
})

describe('textes de partage en anglais', () => {
  it('table et ligue dans la langue du dictionnaire', () => {
    expect(tableShareText({ format: 'duel', seats: 2, hostName: 'Ana' }, en)).toBe('Duel Commander table for 2 hosted by Ana, join me')
    expect(tableShareText({}, en)).toBe('Commander table, join me')
    expect(leagueShareText('Saison e2e', en)).toBe('Join the league Saison e2e')
    expect(leagueShareText(null, en)).toBe('Join my Commander league')
  })
})
