import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { countRecentFailures, getSessionWithUser } from '@/lib/db-auth'
import { hashToken } from './crypto'
import { resolveSession } from './resolve'
import {
  acceptInvitation,
  changePassword,
  issueInvitation,
  loginBootstrap,
  loginWithPassword,
  openSession,
} from './service'

const now = new Date('2026-10-03T12:00:00Z')
const minutes = (n: number) => new Date(now.getTime() + n * 60 * 1000)
const days = (n: number) => new Date(now.getTime() + n * 24 * 3600 * 1000)
const PASSWORD = 'motdepasse1'

let db: D1Database

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex')"),
    db.prepare("INSERT INTO players (id, name) VALUES ('p2', 'Bob')"),
  ])
})

async function invite(playerId: string, kind: 'signup' | 'reset' = 'signup', grantAdmin = false) {
  const r = await issueInvitation(db, { playerId, kind, grantAdmin }, now)
  if (!r.ok) throw new Error(r.error)
  return r.value.token
}

async function createAccount(playerId: string, username: string, grantAdmin = false) {
  const token = await invite(playerId, 'signup', grantAdmin)
  const r = await acceptInvitation(db, token, { username, password: PASSWORD, passwordConfirm: PASSWORD }, now)
  if (!r.ok) throw new Error(r.error)
  return r.value.userId
}

describe('loginWithPassword', () => {
  it('connecte avec un pseudo en casse différente', async () => {
    const userId = await createAccount('p1', 'Alex')
    expect(await loginWithPassword(db, { username: 'alex', password: PASSWORD }, now)).toEqual({ ok: true, value: { userId } })
  })

  it('efface les échecs précédents après un succès', async () => {
    await createAccount('p1', 'Alex')
    await loginWithPassword(db, { username: 'Alex', password: 'mauvais-mdp' }, now)
    await loginWithPassword(db, { username: 'Alex', password: PASSWORD }, now)
    expect((await countRecentFailures(db, 'user:Alex', now)).data).toBe(0)
  })

  it('même erreur pour un pseudo inconnu et un mauvais mot de passe', async () => {
    await createAccount('p1', 'Alex')
    const unknown = await loginWithPassword(db, { username: 'Personne', password: PASSWORD }, now)
    const wrong = await loginWithPassword(db, { username: 'Alex', password: 'mauvais-mdp' }, now)
    expect(unknown).toEqual({ ok: false, status: 401, error: 'Pseudo ou mot de passe incorrect' })
    expect(wrong).toEqual(unknown)
  })

  it('bloque après 5 échecs puis libère après 15 minutes', async () => {
    await createAccount('p1', 'Alex')
    for (let i = 0; i < 5; i++) await loginWithPassword(db, { username: 'Alex', password: 'mauvais-mdp' }, now)
    expect(await loginWithPassword(db, { username: 'Alex', password: PASSWORD }, now)).toEqual({
      ok: false,
      status: 429,
      error: 'Trop de tentatives, réessaie dans 15 minutes',
    })
    expect((await loginWithPassword(db, { username: 'Alex', password: PASSWORD }, minutes(16))).ok).toBe(true)
  })

  it('compte les tentatives simultanées : 5 vérifications au plus', async () => {
    await createAccount('p1', 'Alex')
    const results = await Promise.all(
      Array.from({ length: 20 }, () => loginWithPassword(db, { username: 'Alex', password: 'mauvais-mdp' }, now)),
    )
    expect(results.filter((r) => !r.ok && r.status === 401)).toHaveLength(5)
    expect(results.filter((r) => !r.ok && r.status === 429)).toHaveLength(15)
  })

  it('bloque une IP après 20 tentatives, quel que soit le pseudo', async () => {
    await createAccount('p1', 'Alex')
    for (let i = 0; i < 20; i++) {
      await loginWithPassword(db, { username: `inconnu${i}`, password: 'mauvais-mdp', ip: '203.0.113.7' }, now)
    }
    const blocked = await loginWithPassword(db, { username: 'Alex', password: PASSWORD, ip: '203.0.113.7' }, now)
    expect(blocked).toEqual({ ok: false, status: 429, error: 'Trop de tentatives, réessaie dans 15 minutes' })
    expect((await loginWithPassword(db, { username: 'Alex', password: PASSWORD, ip: '198.51.100.2' }, now)).ok).toBe(true)
  })

  it("une connexion réussie ne compte pas pour l'IP", async () => {
    await createAccount('p1', 'Alex')
    for (let i = 0; i < 25; i++) {
      expect((await loginWithPassword(db, { username: 'Alex', password: PASSWORD, ip: '203.0.113.7' }, now)).ok).toBe(true)
    }
  })

  it('tronque le pseudo saisi à 64 caractères', async () => {
    await loginWithPassword(db, { username: 'x'.repeat(5000), password: 'mauvais-mdp' }, now)
    const row = await db.prepare('SELECT MAX(LENGTH(username)) AS n FROM login_attempts').first<{ n: number }>()
    expect(row!.n).toBeLessThanOrEqual(64 + 'user:'.length)
  })
})

describe('loginBootstrap', () => {
  it("accepte le mot de passe admin tant qu'aucun admin n'existe", async () => {
    expect(await loginBootstrap(db, { adminPassword: 'secret' }, 'secret', now)).toEqual({ ok: true, value: { userId: 'bootstrap' } })
  })

  it('refuse un mauvais mot de passe', async () => {
    expect(await loginBootstrap(db, { adminPassword: 'faux' }, 'secret', now)).toEqual({ ok: false, status: 401, error: 'Mot de passe incorrect' })
  })

  it("refuse si ADMIN_PASSWORD n'est pas configuré", async () => {
    const r = await loginBootstrap(db, { adminPassword: '' }, undefined, now)
    expect(r).toEqual({ ok: false, status: 403, error: 'La connexion par mot de passe admin est désactivée' })
  })

  it('refuse dès qu’un admin existe', async () => {
    await createAccount('p1', 'Alex', true)
    const r = await loginBootstrap(db, { adminPassword: 'secret' }, 'secret', now)
    expect(r).toEqual({ ok: false, status: 403, error: 'La connexion par mot de passe admin est désactivée' })
  })
})

describe('issueInvitation', () => {
  it('refuse un joueur inexistant', async () => {
    expect(await issueInvitation(db, { playerId: 'x', kind: 'signup', grantAdmin: false }, now)).toEqual({
      ok: false,
      status: 404,
      error: 'Joueur introuvable',
    })
  })

  it("refuse une création de compte si le joueur en a déjà un", async () => {
    await createAccount('p1', 'Alex')
    expect(await issueInvitation(db, { playerId: 'p1', kind: 'signup', grantAdmin: false }, now)).toEqual({
      ok: false,
      status: 409,
      error: 'Ce joueur a déjà un compte',
    })
  })

  it("refuse une réinitialisation si le joueur n'a pas de compte", async () => {
    expect(await issueInvitation(db, { playerId: 'p1', kind: 'reset', grantAdmin: false }, now)).toEqual({
      ok: false,
      status: 409,
      error: "Ce joueur n'a pas encore de compte",
    })
  })

  it('renvoie un jeton en clair et sa date d’expiration', async () => {
    const r = await issueInvitation(db, { playerId: 'p1', kind: 'signup', grantAdmin: false }, now)
    expect(r.ok && r.value.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(r.ok && r.value.expiresAt).toBe(days(7).toISOString())
  })
})

describe('acceptInvitation', () => {
  it('crée un compte utilisable pour se connecter', async () => {
    const userId = await createAccount('p1', 'Alex')
    expect(await loginWithPassword(db, { username: 'Alex', password: PASSWORD }, now)).toEqual({ ok: true, value: { userId } })
  })

  it('refuse un jeton invalide', async () => {
    expect(await acceptInvitation(db, 'faux', { username: 'Alex', password: PASSWORD, passwordConfirm: PASSWORD }, now)).toEqual({
      ok: false,
      status: 410,
      error: "Ce lien n'est plus valide, demande un nouveau lien à l'admin",
    })
  })

  it('refuse une invitation déjà utilisée', async () => {
    const token = await invite('p1')
    await acceptInvitation(db, token, { username: 'Alex', password: PASSWORD, passwordConfirm: PASSWORD }, now)
    const again = await acceptInvitation(db, token, { username: 'Alex2', password: PASSWORD, passwordConfirm: PASSWORD }, now)
    expect(again.ok === false && again.status).toBe(410)
  })

  it('refuse une confirmation différente', async () => {
    const token = await invite('p1')
    expect(await acceptInvitation(db, token, { username: 'Alex', password: PASSWORD, passwordConfirm: 'autre-chose' }, now)).toEqual({
      ok: false,
      status: 400,
      error: 'Les mots de passe ne correspondent pas',
    })
  })

  it('refuse un pseudo invalide', async () => {
    const token = await invite('p1')
    const r = await acceptInvitation(db, token, { username: 'a', password: PASSWORD, passwordConfirm: PASSWORD }, now)
    expect(r).toEqual({ ok: false, status: 400, error: 'Le pseudo doit faire 3 à 32 caractères (lettres, chiffres, _ . -)' })
  })

  it('refuse un mot de passe trop court', async () => {
    const token = await invite('p1')
    const r = await acceptInvitation(db, token, { username: 'Alex', password: 'court', passwordConfirm: 'court' }, now)
    expect(r).toEqual({ ok: false, status: 400, error: 'Le mot de passe doit faire au moins 8 caractères' })
  })

  it('refuse un pseudo déjà pris', async () => {
    await createAccount('p1', 'Alex')
    const token = await invite('p2')
    const r = await acceptInvitation(db, token, { username: 'ALEX', password: PASSWORD, passwordConfirm: PASSWORD }, now)
    expect(r).toEqual({ ok: false, status: 409, error: 'Ce pseudo est déjà utilisé' })
  })

  it('réinitialise le mot de passe', async () => {
    const userId = await createAccount('p1', 'Alex')
    const token = await invite('p1', 'reset')
    const r = await acceptInvitation(db, token, { password: 'nouveau-mdp', passwordConfirm: 'nouveau-mdp' }, now)
    expect(r).toEqual({ ok: true, value: { userId } })
    expect((await loginWithPassword(db, { username: 'Alex', password: 'nouveau-mdp' }, now)).ok).toBe(true)
    expect((await loginWithPassword(db, { username: 'Alex', password: PASSWORD }, now)).ok).toBe(false)
  })
})

describe('openSession', () => {
  it('crée une session résolvable par son jeton', async () => {
    const userId = await createAccount('p1', 'Alex')
    const { token, expiresAt } = await openSession(db, userId, now)
    expect(expiresAt.toISOString()).toBe(days(30).toISOString())
    expect((await resolveSession(db, token, now))?.id).toBe(userId)
  })
})

describe('changePassword', () => {
  it('garde la session courante et ferme les autres', async () => {
    const userId = await createAccount('p1', 'Alex')
    const user = (await resolveSession(db, (await openSession(db, userId, now)).token, now))!
    const current = await openSession(db, userId, now)
    const other = await openSession(db, userId, now)
    const r = await changePassword(db, user, { currentPassword: PASSWORD, newPassword: 'nouveau-mdp' }, await hashToken(current.token))
    expect(r).toEqual({ ok: true, value: true })
    expect((await getSessionWithUser(db, await hashToken(current.token))).data).not.toBeNull()
    expect((await getSessionWithUser(db, await hashToken(other.token))).data).toBeNull()
    expect((await loginWithPassword(db, { username: 'Alex', password: 'nouveau-mdp' }, now)).ok).toBe(true)
  })

  it('refuse un mot de passe actuel incorrect', async () => {
    const userId = await createAccount('p1', 'Alex')
    const user = (await resolveSession(db, (await openSession(db, userId, now)).token, now))!
    expect(await changePassword(db, user, { currentPassword: 'faux-faux', newPassword: 'nouveau-mdp' }, 'x')).toEqual({
      ok: false,
      status: 400,
      error: 'Mot de passe actuel incorrect',
    })
  })

  it('refuse un nouveau mot de passe trop court', async () => {
    const userId = await createAccount('p1', 'Alex')
    const user = (await resolveSession(db, (await openSession(db, userId, now)).token, now))!
    const r = await changePassword(db, user, { currentPassword: PASSWORD, newPassword: 'court' }, 'x')
    expect(r).toEqual({ ok: false, status: 400, error: 'Le mot de passe doit faire au moins 8 caractères' })
  })
})

it('openSession accepte la session de démarrage', async () => {
  const { token } = await openSession(db, 'bootstrap', now)
  expect((await resolveSession(db, token, now))?.isBootstrap).toBe(true)
})
