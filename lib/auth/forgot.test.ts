import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import type { Mail, Mailer, MailResult } from '@/lib/mail'
import { acceptInvitation, loginWithPassword, requestPasswordReset } from './service'

const now = new Date('2026-10-05T12:00:00Z')
const minutes = (n: number) => new Date(now.getTime() + n * 60 * 1000)
const NEW_PASSWORD = 'nouveaumotdepasse'

let db: D1Database

function fakeMailer(result: MailResult = 'sent'): Mailer & { sent: Mail[] } {
  const sent: Mail[] = []
  return { sent, send: async (mail) => (sent.push(mail), result) }
}

const ctxOf = (mailer: Mailer) => ({ mailer, baseUrl: 'https://site.test' })
const tokenIn = (mail: Mail) => {
  const m = mail.text.match(/https:\/\/site\.test\/invitation\/([A-Za-z0-9_-]+)/)
  if (!m) throw new Error('lien absent du mail')
  return m[1]
}
const reset = (token: string, at = now) =>
  acceptInvitation(db, token, { password: NEW_PASSWORD, passwordConfirm: NEW_PASSWORD }, at)

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Ana'), ('p2', 'Bob')"),
    db.prepare(
      "INSERT INTO users (id, player_id, username, password_hash, email) VALUES ('u1', 'p1', 'ana', 'x', 'ana@gmail.com'), ('u2', 'p2', 'bob', 'x', NULL)",
    ),
  ])
})

afterEach(() => vi.restoreAllMocks())

describe('requestPasswordReset', () => {
  it('par pseudo : un mail avec un lien utilisable', async () => {
    const mailer = fakeMailer()
    await requestPasswordReset(db, 'ana', now, ctxOf(mailer))
    expect(mailer.sent).toHaveLength(1)
    expect(mailer.sent[0].to).toBe('ana@gmail.com')
    expect(mailer.sent[0].subject).toBe('Commander League — nouveau mot de passe')
    expect(mailer.sent[0].text).toContain('Bonjour Ana')
    expect(mailer.sent[0].text).toContain('valable 1 heure')
    expect(await reset(tokenIn(mailer.sent[0]))).toEqual({ ok: true, value: { userId: 'u1' } })
    expect((await loginWithPassword(db, { username: 'ana', password: NEW_PASSWORD }, now)).ok).toBe(true)
  })

  it('par adresse avec majuscules et espaces', async () => {
    const mailer = fakeMailer()
    await requestPasswordReset(db, ' ANA@Gmail.com ', now, ctxOf(mailer))
    expect(mailer.sent.map((m) => m.to)).toEqual(['ana@gmail.com'])
  })

  it('identifiant inconnu ou vide : aucun mail', async () => {
    const mailer = fakeMailer()
    await requestPasswordReset(db, 'inconnu', now, ctxOf(mailer))
    await requestPasswordReset(db, 'personne@gmail.com', now, ctxOf(mailer))
    await requestPasswordReset(db, '   ', now, ctxOf(mailer))
    expect(mailer.sent).toHaveLength(0)
  })

  it('compte sans adresse : aucun mail, aucune demande comptée', async () => {
    const mailer = fakeMailer()
    await requestPasswordReset(db, 'bob', now, ctxOf(mailer))
    expect(mailer.sent).toHaveLength(0)
    const row = await db.prepare('SELECT COUNT(*) AS n FROM password_requests').first<{ n: number }>()
    expect(Number(row?.n)).toBe(0)
  })

  it('4ᵉ demande dans l’heure : rien, le lien du 3ᵉ mail reste valable', async () => {
    const mailer = fakeMailer()
    for (const at of [0, 10, 20, 30]) await requestPasswordReset(db, 'ana', minutes(at), ctxOf(mailer))
    expect(mailer.sent).toHaveLength(3)
    expect(await reset(tokenIn(mailer.sent[2]), minutes(31))).toEqual({ ok: true, value: { userId: 'u1' } })
  })

  it('demande après une heure de nouveau acceptée', async () => {
    const mailer = fakeMailer()
    for (const at of [0, 1, 2]) await requestPasswordReset(db, 'ana', minutes(at), ctxOf(mailer))
    await requestPasswordReset(db, 'ana', minutes(59), ctxOf(mailer))
    expect(mailer.sent).toHaveLength(3)
    await requestPasswordReset(db, 'ana', minutes(61), ctxOf(mailer))
    expect(mailer.sent).toHaveLength(4)
  })

  it('lien expiré après une heure', async () => {
    const mailer = fakeMailer()
    await requestPasswordReset(db, 'ana', now, ctxOf(mailer))
    expect((await reset(tokenIn(mailer.sent[0]), minutes(61))).ok).toBe(false)
    expect(await reset(tokenIn(mailer.sent[0]), minutes(61))).toMatchObject({ status: 410 })
  })

  it('nouveau lien : l’ancien est annulé', async () => {
    const mailer = fakeMailer()
    await requestPasswordReset(db, 'ana', now, ctxOf(mailer))
    await requestPasswordReset(db, 'ana', minutes(1), ctxOf(mailer))
    expect(await reset(tokenIn(mailer.sent[0]), minutes(2))).toMatchObject({ ok: false, status: 410 })
    expect((await reset(tokenIn(mailer.sent[1]), minutes(2))).ok).toBe(true)
  })

  it('envoi en échec : la demande compte, journal sans adresse ni jeton', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const mailer = fakeMailer('failed')
    for (const at of [0, 1, 2, 3]) await requestPasswordReset(db, 'ana', minutes(at), ctxOf(mailer))
    expect(mailer.sent).toHaveLength(3)
    expect(errors).toHaveBeenCalled()
    const logs = JSON.stringify(errors.mock.calls)
    expect(logs).toContain('[forgot]')
    expect(logs).not.toContain('ana@gmail.com')
    for (const m of mailer.sent) expect(logs).not.toContain(tokenIn(m))
  })

  it('service non configuré : journalisé, sans lever d’erreur', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(requestPasswordReset(db, 'ana', now, ctxOf(fakeMailer('disabled')))).resolves.toBeUndefined()
    expect(JSON.stringify(errors.mock.calls)).toContain('[forgot]')
  })

  it('ne lève jamais d’erreur, même si la base échoue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = { prepare: () => { throw new Error('base indisponible') } } as unknown as D1Database
    await expect(requestPasswordReset(broken, 'ana', now, ctxOf(fakeMailer()))).resolves.toBeUndefined()
    const throwing: Mailer = { send: async () => { throw new Error('boum') } }
    await expect(requestPasswordReset(db, 'ana', now, ctxOf(throwing))).resolves.toBeUndefined()
  })
})
