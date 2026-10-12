import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import {
  createLeague, getLeague, updateLeague, listLeaguesFor, getFeaturedLeague,
  renewInviteToken, getLeagueByInviteToken, isLeagueMember, countScoredMatches, enrollLeaguePlayer,
} from './db-leagues'

let db: D1Database

const ana = { playerId: 'p1', isAdmin: false }
const bob = { playerId: 'p2', isAdmin: false }
const admin = { playerId: 'p9', isAdmin: true }

beforeEach(async () => {
  db = createTestDb()
  await db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Ana'), ('p2', 'Bob'), ('p3', 'Chloé'), ('p9', 'Admin')").run()
})

/** Décale la date de début pour fixer l'ordre « plus récente ». */
const startedAt = (id: string, date: string) =>
  db.prepare('UPDATE leagues SET started_at = ? WHERE id = ?').bind(date, id).run()

describe('createLeague', () => {
  it('plusieurs ligues actives à la fois, avec organisateur et visibilité', async () => {
    const a = await createLeague(db, { name: 'Ligue A', ownerPlayerId: 'p1', visibility: 'private' })
    const b = await createLeague(db, { name: 'Ligue B', ownerPlayerId: 'p2', visibility: 'public' })
    expect(a.error).toBeNull()
    expect(b.error).toBeNull()
    expect(a.data).toMatchObject({ name: 'Ligue A', is_active: true, owner_player_id: 'p1', owner_name: 'Ana', visibility: 'private' })
    expect(b.data).toMatchObject({ owner_name: 'Bob', visibility: 'public' })
  })

  it('une ligue de l’ancien schéma est publique et sans organisateur', async () => {
    await db.prepare("INSERT INTO leagues (id, name) VALUES ('old', 'Saison 1')").run()
    expect((await getLeague(db, 'old')).data).toMatchObject({ visibility: 'public', owner_player_id: null, owner_name: null })
  })

  it('getLeague renvoie null pour une ligue absente', async () => {
    expect((await getLeague(db, 'nope')).data).toBeNull()
  })
})

describe('updateLeague', () => {
  it('change le nom et la visibilité', async () => {
    const { data } = await createLeague(db, { name: 'Ligue A', ownerPlayerId: 'p1', visibility: 'public' })
    const res = await updateLeague(db, data!.id, { name: 'Ligue A2', visibility: 'private' })
    expect(res.data).toMatchObject({ name: 'Ligue A2', visibility: 'private' })
    expect((await updateLeague(db, data!.id, { visibility: 'public' })).data).toMatchObject({ name: 'Ligue A2', visibility: 'public' })
  })

  it('ligue absente', async () => {
    expect((await updateLeague(db, 'nope', { name: 'X' })).error).toBe('Ligue introuvable.')
  })
})

describe('listLeaguesFor', () => {
  let priv: string
  let pub: string

  beforeEach(async () => {
    priv = (await createLeague(db, { name: 'Privée', ownerPlayerId: 'p1', visibility: 'private' })).data!.id
    pub = (await createLeague(db, { name: 'Publique', ownerPlayerId: 'p3', visibility: 'public' })).data!.id
  })

  const ids = async (viewer: Parameters<typeof listLeaguesFor>[1]) =>
    (await listLeaguesFor(db, viewer)).data!.map((l) => l.id).sort()

  it('visiteur et joueur non inscrit : publiques seulement', async () => {
    expect(await ids(null)).toEqual([pub])
    expect(await ids(bob)).toEqual([pub])
  })

  it('organisateur, inscrit et admin voient la privée', async () => {
    expect(await ids(ana)).toEqual([priv, pub].sort())
    await enrollLeaguePlayer(db, priv, 'p2')
    expect(await ids(bob)).toEqual([priv, pub].sort())
    expect(await ids(admin)).toEqual([priv, pub].sort())
  })

  it('isLeagueMember', async () => {
    await enrollLeaguePlayer(db, priv, 'p2')
    expect((await isLeagueMember(db, priv, 'p2')).data).toBe(true)
    expect((await isLeagueMember(db, priv, 'p3')).data).toBe(false)
  })
})

describe('getFeaturedLeague', () => {
  it('aucune ligue en cours : null', async () => {
    expect((await getFeaturedLeague(db, null)).data).toBeNull()
  })

  it('joueur : sa ligue en cours avant une publique plus récente', async () => {
    const mine = (await createLeague(db, { name: 'La mienne', ownerPlayerId: 'p3', visibility: 'private' })).data!.id
    await enrollLeaguePlayer(db, mine, 'p2')
    const other = (await createLeague(db, { name: 'Autre', ownerPlayerId: 'p3', visibility: 'public' })).data!.id
    await startedAt(mine, '2026-01-01 00:00:00')
    await startedAt(other, '2026-06-01 00:00:00')
    expect((await getFeaturedLeague(db, bob)).data?.id).toBe(mine)
    expect((await getFeaturedLeague(db, null)).data?.id).toBe(other)
    expect((await getFeaturedLeague(db, ana)).data?.id).toBe(other)
  })

  it('ignore les ligues archivées et les privées pour un visiteur', async () => {
    const priv = (await createLeague(db, { name: 'Privée', ownerPlayerId: 'p1', visibility: 'private' })).data!.id
    const done = (await createLeague(db, { name: 'Finie', ownerPlayerId: 'p1', visibility: 'public' })).data!.id
    await db.prepare('UPDATE leagues SET is_active = 0 WHERE id = ?').bind(done).run()
    expect((await getFeaturedLeague(db, null)).data).toBeNull()
    expect((await getFeaturedLeague(db, ana)).data?.id).toBe(priv)
  })
})

describe('lien d’invitation', () => {
  it('renouveler change le jeton ; l’ancien ne mène plus à rien', async () => {
    const id = (await createLeague(db, { name: 'L', ownerPlayerId: 'p1', visibility: 'private' })).data!.id
    const first = (await renewInviteToken(db, id)).data!
    expect((await getLeagueByInviteToken(db, first)).data?.id).toBe(id)
    const second = (await renewInviteToken(db, id)).data!
    expect(second).not.toBe(first)
    expect((await getLeagueByInviteToken(db, first)).data).toBeNull()
    expect((await getLeagueByInviteToken(db, second)).data?.id).toBe(id)
  })

  it('jeton vide ou inconnu', async () => {
    expect((await getLeagueByInviteToken(db, '')).data).toBeNull()
    expect((await getLeagueByInviteToken(db, 'inconnu')).data).toBeNull()
  })
})

describe('countScoredMatches', () => {
  it('compte les matchs avec un score saisi', async () => {
    const id = (await createLeague(db, { name: 'L', ownerPlayerId: 'p1', visibility: 'public' })).data!.id
    await db.batch([
      db.prepare("INSERT INTO matches (id, player1_id, player2_id, league_id) VALUES ('m1', 'p1', 'p2', ?)").bind(id),
      db.prepare("INSERT INTO matches (id, player1_id, player2_id, league_id, score_p1, score_p2, is_completed) VALUES ('m2', 'p1', 'p3', ?, 2, 0, 1)").bind(id),
    ])
    expect((await countScoredMatches(db, id)).data).toBe(1)
  })
})
