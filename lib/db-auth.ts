import type { Result } from './db'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DbUser = {
  id: string
  player_id: string
  username: string
  password_hash: string | null
  is_admin: boolean
  created_at: string
}

export type InvitationKind = 'signup' | 'reset'

export type DbInvitation = {
  id: string
  player_id: string
  player_name: string
  kind: InvitationKind
  grant_admin: boolean
  expires_at: string
}

export type AccountStatus =
  | { status: 'none' }
  | { status: 'pending'; expiresAt: string }
  | { status: 'account'; userId: string; username: string; isAdmin: boolean }

export const AUTH_ERR = {
  USERNAME_TAKEN: 'USERNAME_TAKEN',
  PLAYER_HAS_ACCOUNT: 'PLAYER_HAS_ACCOUNT',
  INVITATION_INVALID: 'INVITATION_INVALID',
  LAST_ADMIN: 'LAST_ADMIN',
  NOT_FOUND: 'NOT_FOUND',
} as const

export const INVITATION_TTL_MS = 7 * 24 * 3600 * 1000

// ── Helpers ───────────────────────────────────────────────────────────────────

type Ok<T> = { data: T; error: null }
type Err = { data: null; error: string }
function ok<T>(data: T): Ok<T> { return { data, error: null } }
function err(msg: string): Err { return { data: null, error: msg } }

function normalizeUser(row: Record<string, unknown>): DbUser {
  return {
    id: row.id as string,
    player_id: row.player_id as string,
    username: row.username as string,
    password_hash: (row.password_hash as string) ?? null,
    is_admin: Number(row.is_admin) === 1,
    created_at: row.created_at as string,
  }
}

function uniqueViolation(e: unknown): string | null {
  const msg = (e as Error).message ?? ''
  if (msg.includes('users.username')) return AUTH_ERR.USERNAME_TAKEN
  if (msg.includes('users.player_id')) return AUTH_ERR.PLAYER_HAS_ACCOUNT
  return null
}

// ── Comptes ───────────────────────────────────────────────────────────────────

export async function getUserByUsername(db: D1Database, username: string): Promise<Result<DbUser | null>> {
  try {
    const row = await db
      .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE')
      .bind(username)
      .first<Record<string, unknown>>()
    return ok(row ? normalizeUser(row) : null)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getUserByPlayerId(db: D1Database, playerId: string): Promise<Result<DbUser | null>> {
  try {
    const row = await db.prepare('SELECT * FROM users WHERE player_id = ?').bind(playerId).first<Record<string, unknown>>()
    return ok(row ? normalizeUser(row) : null)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function countAdmins(db: D1Database): Promise<Result<number>> {
  try {
    const row = await db.prepare('SELECT COUNT(*) AS n FROM users WHERE is_admin = 1').first<{ n: number }>()
    return ok(Number(row?.n ?? 0))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function updatePasswordHash(db: D1Database, userId: string, passwordHash: string): Promise<Result<true>> {
  try {
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(passwordHash, userId).run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function setAdmin(db: D1Database, userId: string, isAdmin: boolean): Promise<Result<true>> {
  try {
    const exists = await db.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first()
    if (!exists) return err(AUTH_ERR.NOT_FOUND)
    if (isAdmin) {
      await db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').bind(userId).run()
      return ok(true)
    }
    // Retrait conditionné en une seule requête : il doit rester au moins un autre admin.
    const r = await db
      .prepare(
        `UPDATE users SET is_admin = 0
         WHERE id = ? AND (is_admin = 0 OR (SELECT COUNT(*) FROM users WHERE is_admin = 1) > 1)`,
      )
      .bind(userId)
      .run()
    return r.meta.changes === 0 ? err(AUTH_ERR.LAST_ADMIN) : ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function listAccountStatuses(db: D1Database, now: Date): Promise<Result<Record<string, AccountStatus>>> {
  try {
    const [{ results: users }, { results: invitations }] = await Promise.all([
      db.prepare('SELECT id, player_id, username, is_admin FROM users').all<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT player_id, MAX(expires_at) AS expires_at FROM invitations
           WHERE kind = 'signup' AND used_at IS NULL AND expires_at > ?
           GROUP BY player_id`,
        )
        .bind(now.toISOString())
        .all<Record<string, unknown>>(),
    ])
    const statuses: Record<string, AccountStatus> = {}
    for (const inv of invitations) {
      statuses[inv.player_id as string] = { status: 'pending', expiresAt: inv.expires_at as string }
    }
    for (const u of users) {
      statuses[u.player_id as string] = {
        status: 'account',
        userId: u.id as string,
        username: u.username as string,
        isAdmin: Number(u.is_admin) === 1,
      }
    }
    return ok(statuses)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── Invitations ───────────────────────────────────────────────────────────────

export async function createInvitation(
  db: D1Database,
  input: { idHash: string; playerId: string; kind: InvitationKind; grantAdmin: boolean; now: Date },
): Promise<Result<{ expiresAt: string }>> {
  try {
    const expiresAt = new Date(input.now.getTime() + INVITATION_TTL_MS).toISOString()
    await db.batch([
      db.prepare('DELETE FROM invitations WHERE player_id = ? AND used_at IS NULL').bind(input.playerId),
      db
        .prepare('INSERT INTO invitations (id, player_id, kind, grant_admin, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind(input.idHash, input.playerId, input.kind, input.grantAdmin ? 1 : 0, expiresAt),
    ])
    return ok({ expiresAt })
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getValidInvitation(db: D1Database, idHash: string, now: Date): Promise<Result<DbInvitation | null>> {
  try {
    const row = await db
      .prepare(
        `SELECT i.id, i.player_id, p.name AS player_name, i.kind, i.grant_admin, i.expires_at
         FROM invitations i JOIN players p ON p.id = i.player_id
         WHERE i.id = ? AND i.used_at IS NULL AND i.expires_at > ?`,
      )
      .bind(idHash, now.toISOString())
      .first<Record<string, unknown>>()
    if (!row) return ok(null)
    return ok({
      id: row.id as string,
      player_id: row.player_id as string,
      player_name: row.player_name as string,
      kind: row.kind as InvitationKind,
      grant_admin: Number(row.grant_admin) === 1,
      expires_at: row.expires_at as string,
    })
  } catch (e) {
    return err((e as Error).message)
  }
}

const VALID_INVITATION = 'id = ? AND kind = ? AND used_at IS NULL AND expires_at > ?'

export async function createUserFromInvitation(
  db: D1Database,
  input: { invitationId: string; username: string; passwordHash: string; now: Date },
): Promise<Result<DbUser>> {
  const nowIso = input.now.toISOString()
  try {
    const userId = crypto.randomUUID()
    // L'insertion et la consommation de l'invitation sont atomiques : une double soumission
    // ne trouve plus d'invitation valide et n'insère rien.
    const [insert] = await db.batch([
      db
        .prepare(
          `INSERT INTO users (id, player_id, username, password_hash, is_admin)
           SELECT ?, player_id, ?, ?, grant_admin FROM invitations WHERE ${VALID_INVITATION}`,
        )
        .bind(userId, input.username, input.passwordHash, input.invitationId, 'signup', nowIso),
      db
        .prepare(`UPDATE invitations SET used_at = ? WHERE ${VALID_INVITATION}`)
        .bind(nowIso, input.invitationId, 'signup', nowIso),
    ])
    if (insert.meta.changes === 0) return err(AUTH_ERR.INVITATION_INVALID)
    const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<Record<string, unknown>>()
    return ok(normalizeUser(row!))
  } catch (e) {
    return err(uniqueViolation(e) ?? (e as Error).message)
  }
}

export async function resetPasswordFromInvitation(
  db: D1Database,
  input: { invitationId: string; passwordHash: string; now: Date },
): Promise<Result<{ userId: string }>> {
  const nowIso = input.now.toISOString()
  const args = [input.invitationId, 'reset', nowIso]
  try {
    const user = await db
      .prepare(
        `SELECT u.id FROM users u JOIN invitations i ON i.player_id = u.player_id
         WHERE i.id = ? AND i.kind = ? AND i.used_at IS NULL AND i.expires_at > ?`,
      )
      .bind(...args)
      .first<{ id: string }>()
    if (!user) return err(AUTH_ERR.INVITATION_INVALID)
    const [update] = await db.batch([
      db
        .prepare(`UPDATE users SET password_hash = ? WHERE id = ? AND EXISTS (SELECT 1 FROM invitations WHERE ${VALID_INVITATION})`)
        .bind(input.passwordHash, user.id, ...args),
      db
        .prepare(`DELETE FROM sessions WHERE user_id = ? AND EXISTS (SELECT 1 FROM invitations WHERE ${VALID_INVITATION})`)
        .bind(user.id, ...args),
      db.prepare(`UPDATE invitations SET used_at = ? WHERE ${VALID_INVITATION}`).bind(nowIso, ...args),
    ])
    if (update.meta.changes === 0) return err(AUTH_ERR.INVITATION_INVALID)
    return ok({ userId: user.id })
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export type SessionRow = {
  id: string
  user_id: string
  expires_at: string
  user: (DbUser & { player_name: string; avatar_url: string | null }) | null
}

export async function insertSession(
  db: D1Database,
  input: { idHash: string; userId: string; expiresAt: string },
): Promise<Result<true>> {
  try {
    await db
      .prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(input.idHash, input.userId, input.expiresAt)
      .run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getSessionWithUser(db: D1Database, idHash: string): Promise<Result<SessionRow | null>> {
  try {
    const row = await db
      .prepare(
        `SELECT s.id AS session_id, s.user_id, s.expires_at,
                u.id, u.player_id, u.username, u.password_hash, u.is_admin, u.created_at,
                p.name AS player_name, p.avatar_url
         FROM sessions s
         LEFT JOIN users u ON u.id = s.user_id
         LEFT JOIN players p ON p.id = u.player_id
         WHERE s.id = ?`,
      )
      .bind(idHash)
      .first<Record<string, unknown>>()
    if (!row) return ok(null)
    return ok({
      id: row.session_id as string,
      user_id: row.user_id as string,
      expires_at: row.expires_at as string,
      user: row.id
        ? {
            ...normalizeUser(row),
            player_name: row.player_name as string,
            avatar_url: (row.avatar_url as string) ?? null,
          }
        : null,
    })
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function extendSession(db: D1Database, idHash: string, expiresAt: string): Promise<Result<true>> {
  try {
    await db.prepare('UPDATE sessions SET expires_at = ? WHERE id = ?').bind(expiresAt, idHash).run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deleteSession(db: D1Database, idHash: string): Promise<Result<true>> {
  try {
    await db.prepare('DELETE FROM sessions WHERE id = ?').bind(idHash).run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deleteUserSessions(db: D1Database, userId: string, exceptIdHash?: string): Promise<Result<true>> {
  try {
    await db
      .prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?')
      .bind(userId, exceptIdHash ?? '')
      .run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deleteExpiredSessions(db: D1Database, now: Date): Promise<Result<true>> {
  try {
    await db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now.toISOString()).run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── Anti-force brute ──────────────────────────────────────────────────────────

export const LOGIN_WINDOW_MS = 15 * 60 * 1000

function windowStart(now: Date): string {
  return new Date(now.getTime() - LOGIN_WINDOW_MS).toISOString()
}

export async function countRecentFailures(db: D1Database, username: string, now: Date): Promise<Result<number>> {
  try {
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE username = ? COLLATE NOCASE AND attempted_at > ?')
      .bind(username, windowStart(now))
      .first<{ n: number }>()
    return ok(Number(row?.n ?? 0))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function recordFailure(db: D1Database, username: string, now: Date): Promise<Result<true>> {
  try {
    await db.batch([
      db.prepare('DELETE FROM login_attempts WHERE attempted_at <= ?').bind(windowStart(now)),
      db.prepare('INSERT INTO login_attempts (username, attempted_at) VALUES (?, ?)').bind(username, now.toISOString()),
    ])
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function clearFailures(db: D1Database, username: string): Promise<Result<true>> {
  try {
    await db.prepare('DELETE FROM login_attempts WHERE username = ? COLLATE NOCASE').bind(username).run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}
