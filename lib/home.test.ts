import { describe, expect, it } from 'vitest'
import { en, fr } from '@/lib/i18n/messages'
import { features, myLeagueRank, myPendingMatches, myTables, seasonProgress } from './home'
import type { GameTable } from './db-games'

const player = { isAdmin: false, isBootstrap: false }
const byKey = (user: Parameters<typeof features>[0]) => Object.fromEntries(features(user, fr).map((f) => [f.key, f]))

describe('features', () => {
  it('présente la ligue, les decks, le mode test, le jeu en ligne, les statistiques et les règles', () => {
    expect(features(null, fr).map((f) => f.key)).toEqual(['ligue', 'decks', 'test', 'enligne', 'stats', 'regles'])
  })

  it('visiteur : les rubriques réservées mènent à la connexion, puis à la bonne page', () => {
    const f = byKey(null)
    expect(f.decks).toMatchObject({ href: '/connexion?from=/profil/decks', locked: true })
    expect(f.test).toMatchObject({ href: '/connexion?from=/profil/decks', locked: true })
    expect(f.enligne).toMatchObject({ href: '/connexion?from=/salon', locked: true })
    expect(f.ligue).toMatchObject({ href: '/ligues', locked: false })
    expect(f.stats).toMatchObject({ href: '/ligues/statistiques', locked: false })
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

describe('features en anglais', () => {
  it('textes du dictionnaire, liens inchangés', () => {
    const f = Object.fromEntries(features(null, en).map((x) => [x.key, x]))
    expect(f.ligue).toMatchObject({ title: 'Leagues', cta: 'See the leagues', href: '/ligues' })
    expect(f.enligne).toMatchObject({ title: 'Online games', href: '/connexion?from=/salon' })
    expect(features(null, fr)[0].title).toBe('Les ligues')
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

const table = (id: string, status: GameTable['status'], playerIds: string[], extra: Partial<GameTable> = {}): GameTable => ({
  id, status, hostPlayerId: playerIds[0], format: 'commander', seats: 4, eliminatedSeeAll: false, winnerPlayerId: null,
  durationSeconds: null, gameArchived: false, rematchTableId: null, createdAt: '', lastActivityAt: '',
  players: playerIds.map((playerId, seat) => ({ playerId, name: playerId.toUpperCase(), deckId: null, deckName: null, seat })),
  ...extra,
})

describe('myTables', () => {
  it('garde les tables où je suis assis : parties en cours (« Reprendre ») avant tables ouvertes (« Retourner à la table »)', () => {
    const tables = [
      table('t1', 'open', ['b', 'moi']),
      table('t2', 'playing', ['a', 'c']),
      table('t3', 'playing', ['moi', 'a'], { format: 'duel', seats: 2 }),
    ]
    expect(myTables(tables, 'moi')).toEqual([
      { id: 't3', action: 'Reprendre', format: 'Duel Commander', others: ['A'], seated: 2, seats: 2 },
      { id: 't1', action: 'Retourner à la table', format: 'Commander', others: ['B'], seated: 2, seats: 4 },
    ])
  })

  it('aucune table à moi : liste vide', () => {
    expect(myTables([table('t2', 'playing', ['a', 'c'])], 'moi')).toEqual([])
  })
})

const match = (id: string, p1: string, p2: string, round: number, done = false) => ({
  id, player1_id: p1, player2_id: p2, round_number: round, is_completed: done, score_p1: null, score_p2: null,
})

describe('myPendingMatches', () => {
  const names = new Map([['a', 'Ana'], ['c', 'Chloé']])

  it('mes matchs non joués, par journée, avec le nom de l’adversaire', () => {
    const matches = [
      match('m3', 'c', 'moi', 3),
      match('m1', 'moi', 'a', 1, true),
      match('m2', 'a', 'c', 2),
      match('m4', 'moi', 'a', 2),
    ]
    expect(myPendingMatches({ id: 'l1', name: 'Saison' }, matches, 'moi', names)).toEqual([
      { id: 'm4', leagueId: 'l1', leagueName: 'Saison', round: 2, opponent: 'Ana' },
      { id: 'm3', leagueId: 'l1', leagueName: 'Saison', round: 3, opponent: 'Chloé' },
    ])
  })

  it('adversaire inconnu : nom de remplacement', () => {
    expect(myPendingMatches({ id: 'l1', name: 'Saison' }, [match('m', 'moi', 'z', 1)], 'moi', names)[0].opponent).toBe('Joueur inconnu')
  })
})

describe('myLeagueRank', () => {
  const standings = [{ id: 'a', points: 6 }, { id: 'moi', points: 3 }, { id: 'c', points: 0 }]

  it('ma place, le nombre de joueurs et mes points', () => {
    expect(myLeagueRank(standings, 'moi')).toEqual({ rank: 2, of: 3, points: 3 })
  })

  it('organisateur non inscrit : pas de place', () => {
    expect(myLeagueRank(standings, 'orga')).toBeNull()
  })
})
