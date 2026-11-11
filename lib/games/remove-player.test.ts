import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { getPlayer, PLAYER_ERR } from '@/lib/db'
import { createTable, getTable, joinTable } from '@/lib/db-games'
import { GAME_SERVER_ERROR } from './remove'
import { removePlayer } from './remove-player'

let db: D1Database
let hosted: string
let joined: string
let destroyed: string[]
const destroy = async (id: string) => (destroyed.push(id), true)

beforeEach(async () => {
  db = createTestDb()
  destroyed = []
  await db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex'), ('p2', 'Bob')").run()
  hosted = (await createTable(db, { hostPlayerId: 'p1', format: 'commander', seats: 3, eliminatedSeeAll: false })).data!.id
  joined = (await createTable(db, { hostPlayerId: 'p2', format: 'commander', seats: 3, eliminatedSeeAll: false })).data!.id
  await joinTable(db, joined, 'p1')
})

describe('removePlayer', () => {
  it('supprime la partie des tables dont il est l’hôte, puis le joueur', async () => {
    await db.prepare("UPDATE game_tables SET status = 'playing' WHERE id = ?").bind(hosted).run()
    expect(await removePlayer(db, destroy, 'p1')).toEqual({ data: true, error: null })
    expect(destroyed).toEqual([hosted])
    expect((await getTable(db, hosted)).data).toBeNull()
    expect((await getPlayer(db, 'p1')).data).toBeNull()
    // La table d'un autre hôte reste, sans sa place.
    expect((await getTable(db, joined)).data!.players.map((p) => p.playerId)).toEqual(['p2'])
  })

  it('serveur de jeu en panne : ni la table ni le joueur ne sont supprimés', async () => {
    expect(await removePlayer(db, async () => false, 'p1')).toEqual({ data: null, error: GAME_SERVER_ERROR })
    expect((await getTable(db, hosted)).data).not.toBeNull()
    expect((await getPlayer(db, 'p1')).data).not.toBeNull()
  })

  it('joueur avec un historique de ligue : refus, aucune table touchée', async () => {
    await db.prepare("INSERT INTO leagues (id, name, started_at, is_active) VALUES ('l1', 'Saison', datetime('now'), 1)").run()
    await db.prepare("INSERT INTO league_players (league_id, player_id) VALUES ('l1', 'p1')").run()
    expect(await removePlayer(db, destroy, 'p1')).toEqual({ data: null, error: PLAYER_ERR.HAS_HISTORY })
    expect(destroyed).toEqual([])
    expect((await getTable(db, hosted)).data).not.toBeNull()
  })

  it('dernier admin : refus, aucune table touchée ; avec un autre admin, il est supprimé', async () => {
    await db.prepare("INSERT INTO users (id, player_id, username, is_admin) VALUES ('u1', 'p1', 'alex', 1)").run()
    expect(await removePlayer(db, destroy, 'p1')).toEqual({ data: null, error: PLAYER_ERR.LAST_ADMIN })
    expect(destroyed).toEqual([])
    await db.prepare("INSERT INTO users (id, player_id, username, is_admin) VALUES ('u2', 'p2', 'bob', 1)").run()
    expect((await removePlayer(db, destroy, 'p1')).error).toBeNull()
  })

  it('joueur sans table : supprimé sans appeler le serveur de jeu', async () => {
    await db.prepare("INSERT INTO players (id, name) VALUES ('p3', 'Chloé')").run()
    expect(await removePlayer(db, destroy, 'p3')).toEqual({ data: true, error: null })
    expect(destroyed).toEqual([])
  })
})
