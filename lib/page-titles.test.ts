import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import type { CurrentUser } from '@/lib/auth/types'
import { createTable, joinTable } from '@/lib/db-games'
import { deckMetadata, leagueMetadata, tableMetadata } from './page-titles'

const user = (playerId: string, extra: Partial<CurrentUser> = {}): CurrentUser => ({
  id: `u-${playerId}`, playerId, username: playerId, isAdmin: false, playerName: playerId, avatarUrl: null, isBootstrap: false, ...extra,
})

let db: D1Database
beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('org', 'Ana'), ('mem', 'Bastien'), ('out', 'Chloé')"),
    db.prepare("INSERT INTO leagues (id, name, owner_player_id, visibility) VALUES ('priv', 'Ligue secrète', 'org', 'private'), ('pub', 'Saison 3', 'org', 'public')"),
    db.prepare("INSERT INTO league_players (league_id, player_id) VALUES ('priv', 'mem'), ('priv', 'org')"),
    db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d1', 'mem', 'Kenrith')"),
  ])
})

describe('leagueMetadata', () => {
  it('ligue publique : son nom, pour tout le monde', async () => {
    expect(await leagueMetadata(db, 'pub', null, 'Classement')).toEqual({ title: 'Classement · Saison 3' })
    expect(await leagueMetadata(db, 'pub', user('out'))).toEqual({ title: 'Saison 3' })
  })

  it('ligue privée : jamais son nom pour un non-membre ni pour l’aperçu d’un lien', async () => {
    expect(await leagueMetadata(db, 'priv', null, 'Classement')).toEqual({ title: 'Classement' })
    expect(await leagueMetadata(db, 'priv', user('out'))).toEqual({ title: 'Ligue' })
    expect(await leagueMetadata(db, 'priv', user('mem'), 'Calendrier')).toEqual({ title: 'Calendrier · Ligue secrète' })
    expect(await leagueMetadata(db, 'priv', user('adm', { isAdmin: true }))).toEqual({ title: 'Ligue secrète' })
  })

  it('ligue introuvable : titre générique', async () => {
    expect(await leagueMetadata(db, 'zz', user('mem'), 'Playoffs')).toEqual({ title: 'Playoffs' })
  })
})

describe('deckMetadata', () => {
  it('nom du deck, ou titre générique', async () => {
    expect(await deckMetadata(db, 'd1')).toEqual({ title: 'Kenrith · Deck' })
    expect(await deckMetadata(db, 'd1', 'Mode test')).toEqual({ title: 'Kenrith · Mode test' })
    expect(await deckMetadata(db, 'zz')).toEqual({ title: 'Deck' })
  })
})

describe('tableMetadata', () => {
  it('« Table de <hôte> » pour un joueur connecté, rien de la table pour un visiteur', async () => {
    const id = (await createTable(db, { hostPlayerId: 'org', format: 'commander', seats: 3, eliminatedSeeAll: false })).data!.id
    await joinTable(db, id, 'mem')
    expect(await tableMetadata(db, id, user('out'))).toEqual({ title: 'Table de Ana' })
    expect(await tableMetadata(db, id, null)).toEqual({ title: 'Partie en ligne' })
    expect(await tableMetadata(db, id, user('boot', { isBootstrap: true }))).toEqual({ title: 'Partie en ligne' })
    expect(await tableMetadata(db, 'zz', user('out'))).toEqual({ title: 'Partie en ligne' })
  })
})
