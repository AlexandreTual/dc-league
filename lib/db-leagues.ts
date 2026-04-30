import { getDb } from './db'
import type { DbMatch, DbPlayoff } from './db'
import crypto from 'crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DbLeague = {
  id: string
  name: string
  started_at: string
  ended_at: string | null
  is_active: boolean
}

export type DbLeaguePlayer = {
  league_id: string
  player_id: string
  moxfield_url: string | null
  commander_image_url: string | null
}

export type DbLeaguePlayerWithName = DbLeaguePlayer & {
  name: string
  avatar_url: string | null
}

type Ok<T> = { data: T; error: null }
type Err = { data: null; error: string }
type Result<T> = Ok<T> | Err
function ok<T>(data: T): Ok<T> { return { data, error: null } }
function err(msg: string): Err { return { data: null, error: msg } }
function uuid() { return crypto.randomUUID() }

// ── Normalizers ───────────────────────────────────────────────────────────────

function normalizeLeague(row: Record<string, unknown>): DbLeague {
  return {
    id: row.id as string,
    name: row.name as string,
    started_at: row.started_at as string,
    ended_at: (row.ended_at as string) ?? null,
    is_active: Number(row.is_active) === 1,
  }
}

function normalizeLeaguePlayer(row: Record<string, unknown>): DbLeaguePlayer {
  return {
    league_id: row.league_id as string,
    player_id: row.player_id as string,
    moxfield_url: (row.moxfield_url as string) ?? null,
    commander_image_url: (row.commander_image_url as string) ?? null,
  }
}

function normalizeLeaguePlayerWithName(row: Record<string, unknown>): DbLeaguePlayerWithName {
  return {
    ...normalizeLeaguePlayer(row),
    name: row.name as string,
    avatar_url: (row.avatar_url as string) ?? null,
  }
}

// ── Leagues ───────────────────────────────────────────────────────────────────

export function listLeagues(): Result<DbLeague[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM leagues ORDER BY started_at DESC')
      .all() as Record<string, unknown>[]
    return ok(rows.map(normalizeLeague))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function listArchivedLeagues(): Result<DbLeague[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM leagues WHERE is_active = 0 ORDER BY ended_at DESC')
      .all() as Record<string, unknown>[]
    return ok(rows.map(normalizeLeague))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function getActiveLeague(): Result<DbLeague | null> {
  try {
    const row = getDb()
      .prepare('SELECT * FROM leagues WHERE is_active = 1 LIMIT 1')
      .get() as Record<string, unknown> | undefined
    return ok(row ? normalizeLeague(row) : null)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function createLeague(name: string): Result<DbLeague> {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM leagues WHERE is_active = 1').get()
    if (existing) return err('Une ligue est déjà active.')
    const id = uuid()
    db.prepare(
      `INSERT INTO leagues (id, name, started_at, is_active) VALUES (?, ?, datetime('now'), 1)`
    ).run(id, name)
    const row = db.prepare('SELECT * FROM leagues WHERE id = ?').get(id) as Record<string, unknown>
    return ok(normalizeLeague(row))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function closeLeague(id: string): Result<DbLeague> {
  try {
    const db = getDb()
    const existing = db.prepare('SELECT id FROM leagues WHERE id = ? AND is_active = 1').get(id)
    if (!existing) return err('Ligue introuvable ou déjà archivée.')
    db.prepare(
      `UPDATE leagues SET is_active = 0, ended_at = datetime('now') WHERE id = ?`
    ).run(id)
    const row = db.prepare('SELECT * FROM leagues WHERE id = ?').get(id) as Record<string, unknown>
    return ok(normalizeLeague(row))
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── League Players ─────────────────────────────────────────────────────────────

export function listLeaguePlayers(leagueId: string): Result<DbLeaguePlayerWithName[]> {
  try {
    const rows = getDb()
      .prepare(`
        SELECT lp.*, p.name, p.avatar_url
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        WHERE lp.league_id = ?
        ORDER BY p.name ASC
      `)
      .all(leagueId) as Record<string, unknown>[]
    return ok(rows.map(normalizeLeaguePlayerWithName))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function upsertLeaguePlayer(
  leagueId: string,
  playerId: string,
  data: { moxfield_url?: string | null; commander_image_url?: string | null }
): Result<DbLeaguePlayer> {
  try {
    const db = getDb()
    db.prepare(`
      INSERT INTO league_players (league_id, player_id, moxfield_url, commander_image_url)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(league_id, player_id) DO UPDATE SET
        moxfield_url = excluded.moxfield_url,
        commander_image_url = excluded.commander_image_url
    `).run(leagueId, playerId, data.moxfield_url ?? null, data.commander_image_url ?? null)

    const row = db
      .prepare('SELECT * FROM league_players WHERE league_id = ? AND player_id = ?')
      .get(leagueId, playerId) as Record<string, unknown>
    return ok(normalizeLeaguePlayer(row))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function removeLeaguePlayer(leagueId: string, playerId: string): Result<true> {
  try {
    getDb()
      .prepare('DELETE FROM league_players WHERE league_id = ? AND player_id = ?')
      .run(leagueId, playerId)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── History Detail ─────────────────────────────────────────────────────────────

export function getLeagueDetail(id: string): Result<{
  league: DbLeague
  leaguePlayers: DbLeaguePlayerWithName[]
  matches: DbMatch[]
  playoffs: DbPlayoff[]
} | null> {
  try {
    const db = getDb()
    const leagueRow = db
      .prepare('SELECT * FROM leagues WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined
    if (!leagueRow) return ok(null)

    const { data: leaguePlayers } = listLeaguePlayers(id)

    const matchRows = db
      .prepare('SELECT * FROM matches WHERE league_id = ? ORDER BY round_number ASC, created_at ASC')
      .all(id) as Record<string, unknown>[]

    const STAGE_ORDER = ['semi1', 'semi2', 'final', 'third_place']
    const playoffRows = db
      .prepare('SELECT * FROM playoffs WHERE league_id = ? ORDER BY created_at ASC')
      .all(id) as Record<string, unknown>[]

    const matches: DbMatch[] = matchRows.map((row) => ({
      id: row.id as string,
      player1_id: row.player1_id as string,
      player2_id: row.player2_id as string,
      score_p1: row.score_p1 != null ? Number(row.score_p1) : null,
      score_p2: row.score_p2 != null ? Number(row.score_p2) : null,
      is_completed: Number(row.is_completed) === 1,
      round_number: Number(row.round_number),
      created_at: row.created_at as string,
    }))

    const playoffs: DbPlayoff[] = playoffRows
      .map((row) => ({
        id: row.id as string,
        stage: row.stage as DbPlayoff['stage'],
        player1_id: (row.player1_id as string) ?? null,
        player2_id: (row.player2_id as string) ?? null,
        score_p1: row.score_p1 != null ? Number(row.score_p1) : null,
        score_p2: row.score_p2 != null ? Number(row.score_p2) : null,
        is_completed: Number(row.is_completed) === 1,
        created_at: row.created_at as string,
      }))
      .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))

    return ok({
      league: normalizeLeague(leagueRow),
      leaguePlayers: leaguePlayers ?? [],
      matches,
      playoffs,
    })
  } catch (e) {
    return err((e as Error).message)
  }
}
