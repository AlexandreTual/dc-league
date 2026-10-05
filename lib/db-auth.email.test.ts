import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import {
  AUTH_ERR,
  countPasswordRequests,
  createInvitation,
  createUserFromInvitation,
  getUserByEmail,
  insertTestMail,
  listAccountStatuses,
  listTestMails,
  recordPasswordRequest,
  setUserEmail,
} from './db-auth'

const now = new Date('2026-10-05T12:00:00Z')
const minutes = (n: number) => new Date(now.getTime() + n * 60 * 1000)
const WEEK = 7 * 24 * 3600 * 1000

let db: D1Database

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Ana'), ('p2', 'Bob'), ('p3', 'Chloé')"),
    db.prepare("INSERT INTO users (id, player_id, username, password_hash) VALUES ('u1', 'p1', 'ana', 'x'), ('u2', 'p2', 'bob', 'x')"),
  ])
})

describe('adresse mail des comptes', () => {
  it('enregistre puis retrouve sans casse', async () => {
    expect((await setUserEmail(db, 'u1', 'ana@gmail.com')).error).toBeNull()
    const { data } = await getUserByEmail(db, 'ANA@gmail.com')
    expect(data?.id).toBe('u1')
    expect(data?.email).toBe('ana@gmail.com')
  })

  it('refuse une adresse déjà portée par un autre compte (autre casse)', async () => {
    await setUserEmail(db, 'u1', 'ana@gmail.com')
    expect((await setUserEmail(db, 'u2', 'Ana@Gmail.com')).error).toBe(AUTH_ERR.EMAIL_TAKEN)
  })

  it('plusieurs comptes sans adresse', async () => {
    expect((await setUserEmail(db, 'u1', null)).error).toBeNull()
    expect((await setUserEmail(db, 'u2', null)).error).toBeNull()
    expect((await getUserByEmail(db, '')).data).toBeNull()
  })
})

describe('invitations avec adresse', () => {
  it('copie l’adresse de l’invitation sur le compte créé', async () => {
    await createInvitation(db, { idHash: 'h1', playerId: 'p3', kind: 'signup', grantAdmin: false, now, ttlMs: WEEK, email: 'chloe@gmail.com' })
    const r = await createUserFromInvitation(db, { invitationId: 'h1', username: 'chloe', passwordHash: 'x', now })
    expect(r.data?.email).toBe('chloe@gmail.com')
  })

  it('adresse prise entre-temps : compte créé sans adresse', async () => {
    await createInvitation(db, { idHash: 'h1', playerId: 'p3', kind: 'signup', grantAdmin: false, now, ttlMs: WEEK, email: 'chloe@gmail.com' })
    await setUserEmail(db, 'u1', 'Chloe@gmail.com')
    const r = await createUserFromInvitation(db, { invitationId: 'h1', username: 'chloe', passwordHash: 'x', now })
    expect(r.error).toBeNull()
    expect(r.data?.email).toBeNull()
  })

  it('durée de validité choisie à la création', async () => {
    const r = await createInvitation(db, { idHash: 'h1', playerId: 'p1', kind: 'reset', grantAdmin: false, now, ttlMs: 3600_000 })
    expect(r.data?.expiresAt).toBe('2026-10-05T13:00:00.000Z')
  })

  it('statuts des comptes avec adresse', async () => {
    await setUserEmail(db, 'u1', 'ana@gmail.com')
    await createInvitation(db, { idHash: 'h1', playerId: 'p3', kind: 'signup', grantAdmin: false, now, ttlMs: WEEK, email: 'chloe@gmail.com' })
    const { data } = await listAccountStatuses(db, now)
    expect(data?.p1).toMatchObject({ status: 'account', email: 'ana@gmail.com' })
    expect(data?.p2).toMatchObject({ status: 'account', email: null })
    expect(data?.p3).toMatchObject({ status: 'pending', email: 'chloe@gmail.com' })
  })
})

describe('demandes de mot de passe oublié', () => {
  it('compte les demandes de la dernière heure', async () => {
    for (let i = 0; i < 3; i++) await recordPasswordRequest(db, 'u1', minutes(i))
    await recordPasswordRequest(db, 'u2', now)
    expect((await countPasswordRequests(db, 'u1', minutes(5))).data).toBe(3)
    expect((await countPasswordRequests(db, 'u1', minutes(62))).data).toBe(0)
  })

  it('efface les demandes de plus d’une heure', async () => {
    await recordPasswordRequest(db, 'u1', now)
    await recordPasswordRequest(db, 'u2', minutes(61))
    const row = await db.prepare('SELECT COUNT(*) AS n FROM password_requests').first<{ n: number }>()
    expect(Number(row?.n)).toBe(1)
  })
})

describe('boîte de test', () => {
  it('garde les mails, le plus récent d’abord', async () => {
    await insertTestMail(db, { to: 'a@b.fr', subject: 'un', text: 'premier' })
    await insertTestMail(db, { to: 'a@b.fr', subject: 'deux', text: 'second' })
    const { data } = await listTestMails(db)
    expect(data?.map((m) => m.subject)).toEqual(['deux', 'un'])
    expect(data?.[0]).toMatchObject({ to: 'a@b.fr', text: 'second' })
  })
})
