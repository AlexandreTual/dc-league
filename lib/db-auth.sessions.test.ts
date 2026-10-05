import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import {
  clearFailures,
  countRecentFailures,
  createInvitation,
  createUserFromInvitation,
  deleteExpiredSessions,
  deleteSession,
  deleteUserSessions,
  extendSession,
  getSessionWithUser,
  insertSession,
  recordFailure,
} from './db-auth'

const now = new Date('2026-10-03T12:00:00Z')
const minutes = (n: number) => new Date(now.getTime() + n * 60 * 1000)

let db: D1Database
let userId: string

beforeEach(async () => {
  db = createTestDb()
  await db.prepare("INSERT INTO players (id, name, avatar_url) VALUES ('p1', 'Alex', 'https://img/a.png')").run()
  await createInvitation(db, { idHash: 'i1', playerId: 'p1', kind: 'signup', grantAdmin: true, now })
  userId = (await createUserFromInvitation(db, { invitationId: 'i1', username: 'Alex', passwordHash: 'h', now })).data!.id
})

async function sessionIds() {
  const { results } = await db.prepare('SELECT id FROM sessions ORDER BY id').all<{ id: string }>()
  return results.map((r) => r.id)
}

describe('sessions', () => {
  it("getSessionWithUser renvoie la session et l'utilisateur joint", async () => {
    await insertSession(db, { idHash: 's1', userId, expiresAt: '2026-11-02T12:00:00.000Z' })
    const s = (await getSessionWithUser(db, 's1')).data!
    expect(s).toMatchObject({ id: 's1', user_id: userId, expires_at: '2026-11-02T12:00:00.000Z' })
    expect(s.user).toMatchObject({ id: userId, username: 'Alex', is_admin: true, player_name: 'Alex', avatar_url: 'https://img/a.png' })
  })

  it('user vaut null pour la session de démarrage', async () => {
    await insertSession(db, { idHash: 'b1', userId: 'bootstrap', expiresAt: '2026-11-02T12:00:00.000Z' })
    expect((await getSessionWithUser(db, 'b1')).data?.user).toBeNull()
  })

  it('renvoie null pour une session inconnue', async () => {
    expect((await getSessionWithUser(db, 'x')).data).toBeNull()
  })

  it('extendSession et deleteSession', async () => {
    await insertSession(db, { idHash: 's1', userId, expiresAt: '2026-10-10T00:00:00.000Z' })
    await extendSession(db, 's1', '2026-12-01T00:00:00.000Z')
    expect((await getSessionWithUser(db, 's1')).data?.expires_at).toBe('2026-12-01T00:00:00.000Z')
    await deleteSession(db, 's1')
    expect(await sessionIds()).toEqual([])
  })

  it('deleteUserSessions garde uniquement la session exclue', async () => {
    for (const id of ['s1', 's2', 's3']) await insertSession(db, { idHash: id, userId, expiresAt: '2099-01-01T00:00:00.000Z' })
    await deleteUserSessions(db, userId, 's2')
    expect(await sessionIds()).toEqual(['s2'])
    await deleteUserSessions(db, userId)
    expect(await sessionIds()).toEqual([])
  })

  it('deleteExpiredSessions supprime seulement les sessions expirées', async () => {
    await insertSession(db, { idHash: 'old', userId, expiresAt: now.toISOString() })
    await insertSession(db, { idHash: 'new', userId, expiresAt: minutes(1).toISOString() })
    await deleteExpiredSessions(db, now)
    expect(await sessionIds()).toEqual(['new'])
  })
})

describe('tentatives de connexion', () => {
  it('compte les échecs sur 15 minutes', async () => {
    for (let i = 0; i < 5; i++) await recordFailure(db, 'alex', now)
    expect((await countRecentFailures(db, 'ALEX', now)).data).toBe(5)
    expect((await countRecentFailures(db, 'alex', minutes(16))).data).toBe(0)
  })

  it('clearFailures ignore la casse', async () => {
    await recordFailure(db, 'alex', now)
    await clearFailures(db, 'ALEX')
    expect((await countRecentFailures(db, 'alex', now)).data).toBe(0)
  })

  it('recordFailure purge les lignes de plus de 15 minutes', async () => {
    await recordFailure(db, 'bob', now)
    await recordFailure(db, 'alex', minutes(20))
    const row = await db.prepare('SELECT COUNT(*) AS n FROM login_attempts').first<{ n: number }>()
    expect(row?.n).toBe(1)
  })
})
