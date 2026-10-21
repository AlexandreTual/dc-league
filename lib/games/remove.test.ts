import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { createTable, getTable } from '@/lib/db-games'
import { removeTable, TABLE_ACTIVE_ERROR } from './remove'

let db: D1Database
let tableId: string

beforeEach(async () => {
  db = createTestDb()
  await db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex')").run()
  tableId = (await createTable(db, { hostPlayerId: 'p1', format: 'commander', seats: 3, eliminatedSeeAll: false })).data!.id
})

describe('removeTable', () => {
  it('supprime la partie du serveur de jeu puis la table', async () => {
    const destroyed: string[] = []
    const res = await removeTable(db, async (id) => (destroyed.push(id), true), tableId)
    expect(res).toEqual({ data: null, error: null })
    expect(destroyed).toEqual([tableId])
    expect((await getTable(db, tableId)).data).toBeNull()
  })

  it('garde la table si le serveur de jeu refuse', async () => {
    const res = await removeTable(db, async () => false, tableId)
    expect(res.error).toBe('Le serveur de jeu n’a pas pu supprimer la partie, réessaie plus tard')
    expect((await getTable(db, tableId)).data).not.toBeNull()
  })

  it('garde la table si le serveur de jeu est injoignable', async () => {
    const res = await removeTable(db, async () => { throw new Error('réseau') }, tableId)
    expect(res.error).toBe('Le serveur de jeu n’a pas pu supprimer la partie, réessaie plus tard')
    expect((await getTable(db, tableId)).data).not.toBeNull()
  })

  it('table déjà supprimée : sans erreur', async () => {
    expect(await removeTable(db, async () => true, 'nope')).toEqual({ data: null, error: null })
  })

  describe('seulement si inactive', () => {
    const idleBefore = new Date('2026-01-02T10:00:00Z')

    it('refuse une table touchée depuis : ni la partie ni la table ne sont supprimées', async () => {
      await db.prepare("UPDATE game_tables SET last_activity_at = '2026-01-02 10:05:00'").run()
      const destroyed: string[] = []
      const res = await removeTable(db, async (id) => (destroyed.push(id), true), tableId, { idleBefore })
      expect(res.error).toBe(TABLE_ACTIVE_ERROR)
      expect(destroyed).toEqual([])
      expect((await getTable(db, tableId)).data).not.toBeNull()
    })

    it('supprime une table restée inactive', async () => {
      await db.prepare("UPDATE game_tables SET last_activity_at = '2026-01-01 09:00:00'").run()
      const destroyed: string[] = []
      const res = await removeTable(db, async (id) => (destroyed.push(id), true), tableId, { idleBefore })
      expect(res).toEqual({ data: null, error: null })
      expect(destroyed).toEqual([tableId])
      expect((await getTable(db, tableId)).data).toBeNull()
    })

    it('table déjà supprimée : sans erreur et sans appel au serveur de jeu', async () => {
      const destroyed: string[] = []
      expect(await removeTable(db, async (id) => (destroyed.push(id), true), 'nope', { idleBefore })).toEqual({ data: null, error: null })
      expect(destroyed).toEqual([])
    })
  })
})
