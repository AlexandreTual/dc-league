import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { INVITATION_TTL_MS, createInvitation, createUserFromInvitation, getSessionWithUser, insertSession } from '@/lib/db-auth'
import { hashToken } from './crypto'
import { BOOTSTRAP_USER_ID, resolveSession } from './resolve'

const now = new Date('2026-10-03T12:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * 24 * 3600 * 1000)

let db: D1Database
let userId: string

async function addUser(playerId: string, name: string, grantAdmin: boolean) {
  await db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(playerId, name).run()
  await createInvitation(db, { idHash: `inv-${playerId}`, playerId, kind: 'signup', grantAdmin, now, ttlMs: INVITATION_TTL_MS })
  return (await createUserFromInvitation(db, { invitationId: `inv-${playerId}`, username: name, passwordHash: 'h', now })).data!.id
}

async function addSession(token: string, uid: string, expiresAt: Date) {
  await insertSession(db, { idHash: await hashToken(token), userId: uid, expiresAt: expiresAt.toISOString() })
}

beforeEach(async () => {
  db = createTestDb()
  userId = await addUser('p1', 'Alex', false)
})

describe('resolveSession', () => {
  it('renvoie null sans jeton ou avec un jeton inconnu', async () => {
    expect(await resolveSession(db, undefined, now)).toBeNull()
    expect(await resolveSession(db, 'inconnu', now)).toBeNull()
  })

  it("renvoie l'utilisateur d'une session valide", async () => {
    await addSession('t1', userId, days(20))
    expect(await resolveSession(db, 't1', now)).toEqual({
      id: userId,
      playerId: 'p1',
      username: 'Alex',
      isAdmin: false,
      playerName: 'Alex',
      avatarUrl: null,
      isBootstrap: false,
    })
  })

  it('ignore et supprime une session expirée', async () => {
    await addSession('t1', userId, now)
    expect(await resolveSession(db, 't1', now)).toBeNull()
    expect((await getSessionWithUser(db, await hashToken('t1'))).data).toBeNull()
  })

  it('ignore et supprime une session dont le compte a disparu', async () => {
    await addSession('t1', userId, days(20))
    await db.prepare("DELETE FROM players WHERE id = 'p1'").run()
    expect(await resolveSession(db, 't1', now)).toBeNull()
    expect((await getSessionWithUser(db, await hashToken('t1'))).data).toBeNull()
  })

  it("prolonge une session qui expire dans moins de 29 jours", async () => {
    await addSession('t1', userId, days(28))
    await resolveSession(db, 't1', now)
    expect((await getSessionWithUser(db, await hashToken('t1'))).data?.expires_at).toBe(days(30).toISOString())
  })

  it("ne touche pas une session qui expire dans plus de 29 jours", async () => {
    await addSession('t1', userId, days(29.5))
    await resolveSession(db, 't1', now)
    expect((await getSessionWithUser(db, await hashToken('t1'))).data?.expires_at).toBe(days(29.5).toISOString())
  })

  it("accepte la session de démarrage tant qu'aucun admin n'existe", async () => {
    await addSession('b1', BOOTSTRAP_USER_ID, days(20))
    expect(await resolveSession(db, 'b1', now)).toMatchObject({ id: 'bootstrap', isAdmin: true, isBootstrap: true })
  })

  it('refuse la session de démarrage dès qu’un admin existe', async () => {
    await addSession('b1', BOOTSTRAP_USER_ID, days(20))
    await addUser('p2', 'Bob', true)
    expect(await resolveSession(db, 'b1', now)).toBeNull()
  })
})
