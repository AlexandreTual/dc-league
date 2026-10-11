import { describe, expect, it } from 'vitest'
import { accountLinks, isActive, leagueTabs, mainLinks } from './nav'

const player = { isAdmin: false, isBootstrap: false }
const admin = { isAdmin: true, isBootstrap: false }
const bootstrap = { isAdmin: true, isBootstrap: true }
const hrefs = (links: { href: string }[]) => links.map((l) => l.href)

describe('mainLinks', () => {
  it('visiteur : la ligue et les règles seulement', () => {
    expect(hrefs(mainLinks(null))).toEqual(['/classement', '/rules'])
  })

  it('joueur connecté : la ligue, le salon, ses decks et les règles', () => {
    expect(hrefs(mainLinks(player))).toEqual(['/classement', '/salon', '/profil/decks', '/rules'])
  })

  it("l'administration n'est jamais dans la barre", () => {
    expect(hrefs(mainLinks(admin))).not.toContain('/admin')
    expect(hrefs(mainLinks(bootstrap))).not.toContain('/admin')
  })

  it('compte de démarrage (sans joueur) : ni salon ni decks', () => {
    expect(hrefs(mainLinks(bootstrap))).toEqual(['/classement', '/rules'])
  })
})

describe('accountLinks', () => {
  it('joueur : son profil', () => {
    expect(hrefs(accountLinks(player))).toEqual(['/profil'])
  })

  it("admin : son profil puis l'administration", () => {
    expect(hrefs(accountLinks(admin))).toEqual(['/profil', '/admin'])
  })

  it("compte de démarrage : l'administration seulement", () => {
    expect(hrefs(accountLinks(bootstrap))).toEqual(['/admin'])
  })
})

describe('leagueTabs', () => {
  it('sans playoffs : classement, calendrier, statistiques, historique', () => {
    expect(hrefs(leagueTabs({ hasPlayoffs: false }))).toEqual(['/classement', '/calendar', '/stats', '/history'])
  })

  it('avec playoffs : l’onglet apparaît après le calendrier', () => {
    expect(hrefs(leagueTabs({ hasPlayoffs: true }))).toEqual(['/classement', '/calendar', '/playoffs', '/stats', '/history'])
  })
})

describe('isActive', () => {
  it('« Ligue » reste actif sur toutes les pages de la ligue', () => {
    for (const path of ['/classement', '/calendar', '/playoffs', '/stats', '/history', '/history/abc']) {
      expect(isActive('/classement', path)).toBe(true)
    }
  })

  it('« Ligue » n’est pas actif sur l’accueil ni sur les règles', () => {
    expect(isActive('/classement', '/')).toBe(false)
    expect(isActive('/classement', '/rules')).toBe(false)
  })

  it('« Jouer » reste actif sur une table en ligne', () => {
    expect(isActive('/salon', '/tables/t1')).toBe(true)
  })

  it('« Mes decks » reste actif sur la page d’un deck et son mode test, pas sur le profil', () => {
    expect(isActive('/profil/decks', '/decks/d1')).toBe(true)
    expect(isActive('/profil/decks', '/decks/d1/test')).toBe(true)
    expect(isActive('/profil/decks', '/profil')).toBe(false)
  })

  it('un onglet de la ligue ne s’allume que sur sa page', () => {
    expect(isActive('/history', '/history/abc', 'tab')).toBe(true)
    expect(isActive('/classement', '/calendar', 'tab')).toBe(false)
    expect(isActive('/calendar', '/calendar', 'tab')).toBe(true)
  })
})
