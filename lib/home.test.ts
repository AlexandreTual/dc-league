import { describe, expect, it } from 'vitest'
import { features, seasonProgress } from './home'

const player = { isAdmin: false, isBootstrap: false }
const byKey = (user: Parameters<typeof features>[0]) => Object.fromEntries(features(user).map((f) => [f.key, f]))

describe('features', () => {
  it('présente la ligue, les decks, le mode test, le jeu en ligne, les statistiques et les règles', () => {
    expect(features(null).map((f) => f.key)).toEqual(['ligue', 'decks', 'test', 'enligne', 'stats', 'regles'])
  })

  it('visiteur : les rubriques réservées mènent à la connexion, puis à la bonne page', () => {
    const f = byKey(null)
    expect(f.decks).toMatchObject({ href: '/connexion?from=/profil/decks', locked: true })
    expect(f.test).toMatchObject({ href: '/connexion?from=/profil/decks', locked: true })
    expect(f.enligne).toMatchObject({ href: '/connexion?from=/salon', locked: true })
    expect(f.ligue).toMatchObject({ href: '/classement', locked: false })
    expect(f.regles).toMatchObject({ href: '/rules', locked: false })
  })

  it('joueur connecté : liens directs', () => {
    const f = byKey(player)
    expect(f.decks).toMatchObject({ href: '/profil/decks', locked: false })
    expect(f.enligne).toMatchObject({ href: '/salon', locked: false })
  })

  it('compte de démarrage : decks et salon restent fermés (pas de joueur)', () => {
    const f = byKey({ isAdmin: true, isBootstrap: true })
    expect(f.decks.locked).toBe(true)
    expect(f.enligne.locked).toBe(true)
  })
})

describe('seasonProgress', () => {
  it('pourcentage arrondi des matchs joués', () => {
    expect(seasonProgress(1, 3)).toBe(33)
    expect(seasonProgress(3, 3)).toBe(100)
  })

  it('aucun match : 0 %', () => {
    expect(seasonProgress(0, 0)).toBe(0)
  })
})
