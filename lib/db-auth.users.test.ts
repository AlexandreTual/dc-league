import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import {
  AUTH_ERR,
  countAdmins,
  INVITATION_TTL_MS, createInvitation,
  createUserFromInvitation,
  getUserByPlayerId,
  getUserByUsername,
  getValidInvitation,
  listAccountStatuses,
  resetPasswordFromInvitation,
  setAdmin,
} from './db-auth'

const now = new Date('2026-10-03T12:00:00Z')
const days = (n: number) => new Date(now.getTime() + n * 24 * 3600 * 1000)

let db: D1Database

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex')"),
    db.prepare("INSERT INTO players (id, name) VALUES ('p2', 'Bob')"),
    db.prepare("INSERT INTO players (id, name) VALUES ('p3', 'Chloé')"),
  ])
})

async function signup(playerId: string, username: string, opts: { grantAdmin?: boolean; idHash?: string } = {}) {
  const idHash = opts.idHash ?? `inv-${playerId}-${username}`
  await createInvitation(db, { idHash, playerId, kind: 'signup', grantAdmin: opts.grantAdmin ?? false, now, ttlMs: INVITATION_TTL_MS })
  return createUserFromInvitation(db, { invitationId: idHash, username, passwordHash: 'h', now })
}

describe('invitations et création de compte', () => {
  it("crée le compte et consomme l'invitation", async () => {
    const r = await signup('p1', 'Alex', { idHash: 'i1' })
    expect(r.error).toBeNull()
    expect(r.data?.player_id).toBe('p1')
    expect((await getUserByUsername(db, 'ALEX')).data?.id).toBe(r.data?.id)
    expect((await getValidInvitation(db, 'i1', now)).data).toBeNull()
  })

  it('getValidInvitation renvoie le nom du joueur', async () => {
    await createInvitation(db, { idHash: 'i1', playerId: 'p1', kind: 'signup', grantAdmin: false, now, ttlMs: INVITATION_TTL_MS })
    const inv = (await getValidInvitation(db, 'i1', now)).data
    expect(inv).toMatchObject({ player_id: 'p1', player_name: 'Alex', kind: 'signup', grant_admin: false })
  })

  it("refuse une seconde utilisation de la même invitation", async () => {
    await signup('p1', 'Alex', { idHash: 'i1' })
    const again = await createUserFromInvitation(db, { invitationId: 'i1', username: 'Autre', passwordHash: 'h', now })
    expect(again.error).toBe(AUTH_ERR.INVITATION_INVALID)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n).toBe(1)
  })

  it('refuse une invitation expirée', async () => {
    await createInvitation(db, { idHash: 'i1', playerId: 'p1', kind: 'signup', grantAdmin: false, now, ttlMs: INVITATION_TTL_MS })
    expect((await getValidInvitation(db, 'i1', days(8))).data).toBeNull()
    const r = await createUserFromInvitation(db, { invitationId: 'i1', username: 'Alex', passwordHash: 'h', now: days(8) })
    expect(r.error).toBe(AUTH_ERR.INVITATION_INVALID)
  })

  it('une nouvelle invitation annule la précédente', async () => {
    await createInvitation(db, { idHash: 'old', playerId: 'p1', kind: 'signup', grantAdmin: false, now, ttlMs: INVITATION_TTL_MS })
    await createInvitation(db, { idHash: 'new', playerId: 'p1', kind: 'signup', grantAdmin: false, now, ttlMs: INVITATION_TTL_MS })
    expect((await getValidInvitation(db, 'old', now)).data).toBeNull()
    expect((await getValidInvitation(db, 'new', now)).data).not.toBeNull()
  })

  it("renvoie la date d'expiration à 7 jours", async () => {
    const r = await createInvitation(db, { idHash: 'i1', playerId: 'p1', kind: 'signup', grantAdmin: false, now, ttlMs: INVITATION_TTL_MS })
    expect(r.data?.expiresAt).toBe(days(7).toISOString())
  })

  it('refuse un pseudo déjà pris sans distinction de casse', async () => {
    await signup('p1', 'Alex')
    const r = await signup('p2', 'alex')
    expect(r.error).toBe(AUTH_ERR.USERNAME_TAKEN)
  })

  it('refuse un second compte pour le même joueur', async () => {
    await signup('p1', 'Alex')
    const r = await signup('p1', 'Alex2')
    expect(r.error).toBe(AUTH_ERR.PLAYER_HAS_ACCOUNT)
  })

  it('grant_admin donne le rôle admin', async () => {
    const r = await signup('p1', 'Alex', { grantAdmin: true })
    expect(r.data?.is_admin).toBe(true)
    expect((await countAdmins(db)).data).toBe(1)
  })
})

describe('réinitialisation du mot de passe', () => {
  it('change le hachage et supprime les sessions', async () => {
    const user = (await signup('p1', 'Alex')).data!
    await db.batch([
      db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES ('s1', ?, '2099-01-01')").bind(user.id),
      db.prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES ('s2', ?, '2099-01-01')").bind(user.id),
    ])
    await createInvitation(db, { idHash: 'r1', playerId: 'p1', kind: 'reset', grantAdmin: false, now, ttlMs: INVITATION_TTL_MS })
    const r = await resetPasswordFromInvitation(db, { invitationId: 'r1', passwordHash: 'nouveau', now })
    expect(r.data?.userId).toBe(user.id)
    expect((await getUserByPlayerId(db, 'p1')).data?.password_hash).toBe('nouveau')
    expect((await db.prepare('SELECT COUNT(*) AS n FROM sessions').first<{ n: number }>())?.n).toBe(0)
    expect((await getValidInvitation(db, 'r1', now)).data).toBeNull()
  })

  it('refuse une invitation de type signup', async () => {
    await signup('p1', 'Alex')
    await createInvitation(db, { idHash: 's1', playerId: 'p1', kind: 'signup', grantAdmin: false, now, ttlMs: INVITATION_TTL_MS })
    const r = await resetPasswordFromInvitation(db, { invitationId: 's1', passwordHash: 'x', now })
    expect(r.error).toBe(AUTH_ERR.INVITATION_INVALID)
  })
})

describe('setAdmin', () => {
  it('refuse de retirer le rôle au dernier admin', async () => {
    const admin = (await signup('p1', 'Alex', { grantAdmin: true })).data!
    expect((await setAdmin(db, admin.id, false)).error).toBe(AUTH_ERR.LAST_ADMIN)
    expect((await countAdmins(db)).data).toBe(1)
  })

  it("retire le rôle quand il reste un autre admin", async () => {
    const a = (await signup('p1', 'Alex', { grantAdmin: true })).data!
    const b = (await signup('p2', 'Bob')).data!
    expect((await setAdmin(db, b.id, true)).error).toBeNull()
    expect((await setAdmin(db, a.id, false)).error).toBeNull()
    expect((await countAdmins(db)).data).toBe(1)
  })

  it('renvoie NOT_FOUND pour un compte inconnu', async () => {
    expect((await setAdmin(db, 'inconnu', true)).error).toBe(AUTH_ERR.NOT_FOUND)
  })
})

describe('listAccountStatuses', () => {
  it("donne l'état de chaque joueur", async () => {
    await signup('p1', 'Alex', { grantAdmin: true })
    await createInvitation(db, { idHash: 'i2', playerId: 'p2', kind: 'signup', grantAdmin: false, now, ttlMs: INVITATION_TTL_MS })
    const statuses = (await listAccountStatuses(db, now)).data!
    expect(statuses.p1).toMatchObject({ status: 'account', username: 'Alex', isAdmin: true })
    expect(statuses.p2).toEqual({ status: 'pending', email: null, expiresAt: days(7).toISOString() })
    expect(statuses.p3 ?? { status: 'none' }).toEqual({ status: 'none' })
  })

  it('ignore une invitation expirée', async () => {
    await createInvitation(db, { idHash: 'i2', playerId: 'p2', kind: 'signup', grantAdmin: false, now, ttlMs: INVITATION_TTL_MS })
    const statuses = (await listAccountStatuses(db, days(8))).data!
    expect(statuses.p2 ?? { status: 'none' }).toEqual({ status: 'none' })
  })
})
