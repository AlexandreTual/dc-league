import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { clearErrors, ERROR_FIELD_MAX, ERROR_LOG_MAX, listErrors, recordError } from './db-errors'

const now = new Date('2026-10-20T12:00:00Z')
let db: D1Database
beforeEach(() => {
  db = createTestDb()
})

describe('journal des erreurs', () => {
  it('enregistre une erreur et la relit, la plus récente d’abord', async () => {
    await recordError(db, { source: 'serveur', message: 'D1 indisponible', path: '/api/leagues' }, now)
    await recordError(db, { source: 'navigateur', message: 'boom', digest: '123', path: '/ligues/x', userId: 'u1' }, now)
    const { data } = await listErrors(db)
    expect(data).toEqual([
      { id: 2, at: now.toISOString(), source: 'navigateur', message: 'boom', digest: '123', path: '/ligues/x', userId: 'u1', userName: null },
      { id: 1, at: now.toISOString(), source: 'serveur', message: 'D1 indisponible', digest: null, path: '/api/leagues', userId: null, userName: null },
    ])
  })

  it('donne le nom du joueur du compte', async () => {
    await db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Chloé')").run()
    await db.prepare("INSERT INTO users (id, player_id, username) VALUES ('u1', 'p1', 'chloe')").run()
    await recordError(db, { source: 'navigateur', message: 'boom', userId: 'u1' }, now)
    expect((await listErrors(db)).data![0].userName).toBe('Chloé')
  })

  it('coupe les textes trop longs', async () => {
    await recordError(db, { source: 'navigateur', message: 'x'.repeat(5000), path: 'y'.repeat(5000) }, now)
    const [row] = (await listErrors(db)).data!
    expect(row.message).toHaveLength(ERROR_FIELD_MAX)
    expect(row.path).toHaveLength(ERROR_FIELD_MAX)
  })

  it(`ne garde que les ${ERROR_LOG_MAX} dernières erreurs`, async () => {
    for (let i = 1; i <= ERROR_LOG_MAX + 5; i++) await recordError(db, { source: 'serveur', message: `e${i}` }, now)
    const { data } = await listErrors(db, 1000)
    expect(data).toHaveLength(ERROR_LOG_MAX)
    expect(data![0].message).toBe(`e${ERROR_LOG_MAX + 5}`)
    expect(data!.at(-1)!.message).toBe('e6')
  })

  it('vide le journal', async () => {
    await recordError(db, { source: 'serveur', message: 'e' }, now)
    await clearErrors(db)
    expect((await listErrors(db)).data).toEqual([])
  })

  it("renvoie une erreur si la table n'existe pas encore", async () => {
    const old = createTestDb(['0001_schema.sql'])
    expect((await recordError(old, { source: 'serveur', message: 'e' }, now)).error).not.toBeNull()
    expect((await listErrors(old)).error).not.toBeNull()
  })
})
