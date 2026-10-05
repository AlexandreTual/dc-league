import {
  AUTH_ERR,
  clearFailures,
  countAdmins,
  createInvitation,
  createUserFromInvitation,
  deleteExpiredSessions,
  deleteUserSessions,
  getUserById,
  getUserByPlayerId,
  getUserByUsername,
  getValidInvitation,
  INVITATION_TTL_MS,
  insertSession,
  forgetAttempt,
  playerExists,
  recordAttempt,
  resetPasswordFromInvitation,
  updatePasswordHash,
  type InvitationKind,
} from '@/lib/db-auth'
import { generateToken, hashPassword, hashToken, verifyDummyPassword, verifyPassword } from './crypto'
import { SESSION_TTL_MS } from './resolve'
import type { CurrentUser, ServiceResult } from './types'
import { validatePassword, validateUsername } from './validation'

const MAX_FAILURES = 5
const MAX_IP_ATTEMPTS = 20
const MAX_USERNAME_KEY = 64

/** Clés du compteur de tentatives : par pseudo (tronqué) et par IP (`CF-Connecting-IP`). */
const attemptKey = {
  user: (username: string) => `user:${username.slice(0, MAX_USERNAME_KEY)}`,
  ip: (ip: string) => `ip:${ip.slice(0, MAX_USERNAME_KEY)}`,
}

type Attempt = { blocked: true } | { blocked: false; ipKey: string | null } | { error: string }

/** Enregistre la tentative avant toute vérification ; bloquée si une des limites est dépassée. */
async function registerAttempt(db: D1Database, key: string, ip: string | null | undefined, now: Date): Promise<Attempt> {
  const ipKey = ip ? attemptKey.ip(ip) : null
  const counts = await recordAttempt(db, ipKey ? [key, ipKey] : [key], now)
  if (counts.error !== null) return { error: counts.error }
  const [keyCount, ipCount = 0] = counts.data
  if (keyCount > MAX_FAILURES || ipCount > MAX_IP_ATTEMPTS) return { blocked: true }
  return { blocked: false, ipKey }
}

/** Connexion réussie : on efface les échecs de la clé et la tentative comptée pour l'IP. */
async function forgetSuccess(db: D1Database, key: string, ipKey: string | null, now: Date): Promise<void> {
  await clearFailures(db, key)
  if (ipKey) await forgetAttempt(db, ipKey, now)
}

const MSG = {
  BAD_CREDENTIALS: 'Pseudo ou mot de passe incorrect',
  TOO_MANY: 'Trop de tentatives, réessaie dans 15 minutes',
  BOOTSTRAP_DISABLED: 'La connexion par mot de passe admin est désactivée',
  BAD_ADMIN_PASSWORD: 'Mot de passe incorrect',
  INVITATION_INVALID: "Ce lien n'est plus valide, demande un nouveau lien à l'admin",
  MISMATCH: 'Les mots de passe ne correspondent pas',
  USERNAME_TAKEN: 'Ce pseudo est déjà utilisé',
  PLAYER_HAS_ACCOUNT: 'Ce joueur a déjà un compte',
  PLAYER_HAS_NO_ACCOUNT: "Ce joueur n'a pas encore de compte",
  PLAYER_NOT_FOUND: 'Joueur introuvable',
  BAD_CURRENT_PASSWORD: 'Mot de passe actuel incorrect',
  INTERNAL: 'Erreur interne, réessaie plus tard',
}

function fail<T>(status: number, error: string): ServiceResult<T> {
  return { ok: false, status, error }
}

function internal<T>(detail: string): ServiceResult<T> {
  console.error('[auth]', detail)
  return fail(500, MSG.INTERNAL)
}

export async function loginWithPassword(
  db: D1Database,
  input: { username: string; password: string; ip?: string | null },
  now: Date,
): Promise<ServiceResult<{ userId: string }>> {
  const username = input.username.trim().slice(0, MAX_USERNAME_KEY)
  const key = attemptKey.user(username)
  const attempt = await registerAttempt(db, key, input.ip, now)
  if ('error' in attempt) return internal(attempt.error)
  if (attempt.blocked) return fail(429, MSG.TOO_MANY)

  const { data: user, error } = await getUserByUsername(db, username)
  if (error !== null) return internal(error)
  if (!user) {
    await verifyDummyPassword(input.password)
  } else if (await verifyPassword(input.password, user.password_hash)) {
    await forgetSuccess(db, key, attempt.ipKey, now)
    return { ok: true, value: { userId: user.id } }
  }
  return fail(401, MSG.BAD_CREDENTIALS)
}

export async function loginBootstrap(
  db: D1Database,
  input: { adminPassword: string; ip?: string | null },
  envAdminPassword: string | undefined,
  now: Date,
): Promise<ServiceResult<{ userId: 'bootstrap' }>> {
  if (!envAdminPassword) return fail(403, MSG.BOOTSTRAP_DISABLED)
  const admins = await countAdmins(db)
  if (admins.error !== null) return internal(admins.error)
  if (admins.data > 0) return fail(403, MSG.BOOTSTRAP_DISABLED)

  const attempt = await registerAttempt(db, 'bootstrap', input.ip, now)
  if ('error' in attempt) return internal(attempt.error)
  if (attempt.blocked) return fail(429, MSG.TOO_MANY)

  // Comparaison sur les empreintes pour un temps constant indépendant du contenu.
  if ((await hashToken(input.adminPassword)) !== (await hashToken(envAdminPassword))) {
    return fail(401, MSG.BAD_ADMIN_PASSWORD)
  }
  await forgetSuccess(db, 'bootstrap', attempt.ipKey, now)
  return { ok: true, value: { userId: 'bootstrap' } }
}

export async function openSession(db: D1Database, userId: string, now: Date): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken()
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
  const r = await insertSession(db, { idHash: await hashToken(token), userId, expiresAt: expiresAt.toISOString() })
  if (r.error) throw new Error(r.error)
  await deleteExpiredSessions(db, now)
  return { token, expiresAt }
}

export async function issueInvitation(
  db: D1Database,
  input: { playerId: string; kind: InvitationKind; grantAdmin: boolean },
  now: Date,
): Promise<ServiceResult<{ token: string; expiresAt: string }>> {
  const exists = await playerExists(db, input.playerId)
  if (exists.error !== null) return internal(exists.error)
  if (!exists.data) return fail(404, MSG.PLAYER_NOT_FOUND)

  const account = await getUserByPlayerId(db, input.playerId)
  if (account.error !== null) return internal(account.error)
  if (input.kind === 'signup' && account.data) return fail(409, MSG.PLAYER_HAS_ACCOUNT)
  if (input.kind === 'reset' && !account.data) return fail(409, MSG.PLAYER_HAS_NO_ACCOUNT)

  const token = generateToken()
  const r = await createInvitation(db, {
    idHash: await hashToken(token),
    playerId: input.playerId,
    kind: input.kind,
    grantAdmin: input.kind === 'signup' && input.grantAdmin,
    now,
    ttlMs: INVITATION_TTL_MS,
  })
  if (r.error !== null) return internal(r.error)
  return { ok: true, value: { token, expiresAt: r.data.expiresAt } }
}

export async function acceptInvitation(
  db: D1Database,
  token: string,
  input: { username?: string; password: string; passwordConfirm: string },
  now: Date,
): Promise<ServiceResult<{ userId: string }>> {
  const invitationId = await hashToken(token)
  const { data: invitation, error } = await getValidInvitation(db, invitationId, now)
  if (error !== null) return internal(error)
  if (!invitation) return fail(410, MSG.INVITATION_INVALID)

  const passwordError = validatePassword(input.password)
  if (passwordError) return fail(400, passwordError)
  if (input.password !== input.passwordConfirm) return fail(400, MSG.MISMATCH)
  const passwordHash = await hashPassword(input.password)

  if (invitation.kind === 'reset') {
    const r = await resetPasswordFromInvitation(db, { invitationId, passwordHash, now })
    if (r.error === AUTH_ERR.INVITATION_INVALID) return fail(410, MSG.INVITATION_INVALID)
    if (r.error !== null) return internal(r.error)
    return { ok: true, value: { userId: r.data.userId } }
  }

  const username = (input.username ?? '').trim()
  const usernameError = validateUsername(username)
  if (usernameError) return fail(400, usernameError)

  const r = await createUserFromInvitation(db, { invitationId, username, passwordHash, now })
  if (r.error === AUTH_ERR.INVITATION_INVALID) return fail(410, MSG.INVITATION_INVALID)
  if (r.error === AUTH_ERR.USERNAME_TAKEN) return fail(409, MSG.USERNAME_TAKEN)
  if (r.error === AUTH_ERR.PLAYER_HAS_ACCOUNT) return fail(409, MSG.PLAYER_HAS_ACCOUNT)
  if (r.error !== null) return internal(r.error)
  return { ok: true, value: { userId: r.data.id } }
}

export async function changePassword(
  db: D1Database,
  user: CurrentUser,
  input: { currentPassword: string; newPassword: string },
  currentSessionIdHash: string,
): Promise<ServiceResult<true>> {
  const { data: account, error } = await getUserById(db, user.id)
  if (error !== null) return internal(error)
  if (!account || !(await verifyPassword(input.currentPassword, account.password_hash))) {
    return fail(400, MSG.BAD_CURRENT_PASSWORD)
  }
  const passwordError = validatePassword(input.newPassword)
  if (passwordError) return fail(400, passwordError)

  const updated = await updatePasswordHash(db, user.id, await hashPassword(input.newPassword))
  if (updated.error !== null) return internal(updated.error)
  const closed = await deleteUserSessions(db, user.id, currentSessionIdHash)
  if (closed.error !== null) return internal(closed.error)
  return { ok: true, value: true }
}
