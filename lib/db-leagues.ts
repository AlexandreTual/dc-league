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
  deck_id: string | null
  moxfield_url: string | null
  commander_image_url: string | null
}

export type DbLeaguePlayerWithName = DbLeaguePlayer & {
  name: string
  avatar_url: string | null
  deck_name: string | null
  deck_moxfield_url: string | null
  deck_commander_image_url: string | null
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
    deck_id: (row.deck_id as string) ?? null,
    moxfield_url: (row.moxfield_url as string) ?? null,
    commander_image_url: (row.commander_image_url as string) ?? null,
  }
}

function normalizeLeaguePlayerWithName(row: Record<string, unknown>): DbLeaguePlayerWithName {
  return {
    ...normalizeLeaguePlayer(row),
    name: row.name as string,
    avatar_url: (row.avatar_url as string) ?? null,
    deck_name: (row.deck_name as string) ?? null,
    deck_moxfield_url: (row.deck_moxfield_url as string) ?? null,
    deck_commander_image_url: (row.deck_commander_image_url as string) ?? null,
  }
}

// ── Leagues ───────────────────────────────────────────────────────────────────

export async function listLeagues(db: D1Database): Promise<Result<DbLeague[]>> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM leagues ORDER BY started_at DESC')
      .all<Record<string, unknown>>()
    return ok(results.map(normalizeLeague))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function listArchivedLeagues(db: D1Database): Promise<Result<DbLeague[]>> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM leagues WHERE is_active = 0 ORDER BY ended_at DESC')
      .all<Record<string, unknown>>()
    return ok(results.map(normalizeLeague))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getActiveLeague(db: D1Database): Promise<Result<DbLeague | null>> {
  try {
    const row = await db
      .prepare('SELECT * FROM leagues WHERE is_active = 1 LIMIT 1')
      .first<Record<string, unknown>>()
    return ok(row ? normalizeLeague(row) : null)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function createLeague(db: D1Database, name: string): Promise<Result<DbLeague>> {
  try {
    const existing = await db.prepare('SELECT id FROM leagues WHERE is_active = 1').first()
    if (existing) return err('Une ligue est déjà active.')
    const id = uuid()
    await db
      .prepare(`INSERT INTO leagues (id, name, started_at, is_active) VALUES (?, ?, datetime('now'), 1)`)
      .bind(id, name)
      .run()
    const row = await db.prepare('SELECT * FROM leagues WHERE id = ?').bind(id).first<Record<string, unknown>>()
    return ok(normalizeLeague(row!))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deleteLeague(db: D1Database, id: string): Promise<Result<true>> {
  try {
    const existing = await db.prepare('SELECT id FROM leagues WHERE id = ?').bind(id).first()
    if (!existing) return err('Ligue introuvable.')
    await db.batch([
      db.prepare('DELETE FROM playoffs WHERE league_id = ?').bind(id),
      db.prepare('DELETE FROM matches WHERE league_id = ?').bind(id),
      db.prepare('DELETE FROM league_players WHERE league_id = ?').bind(id),
      db.prepare('DELETE FROM leagues WHERE id = ?').bind(id),
    ])
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function closeLeague(db: D1Database, id: string): Promise<Result<DbLeague>> {
  try {
    const existing = await db
      .prepare('SELECT id FROM leagues WHERE id = ? AND is_active = 1')
      .bind(id)
      .first()
    if (!existing) return err('Ligue introuvable ou déjà archivée.')
    await db
      .prepare(`UPDATE leagues SET is_active = 0, ended_at = datetime('now') WHERE id = ?`)
      .bind(id)
      .run()
    const row = await db.prepare('SELECT * FROM leagues WHERE id = ?').bind(id).first<Record<string, unknown>>()
    return ok(normalizeLeague(row!))
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── League Players ─────────────────────────────────────────────────────────────

export async function listLeaguePlayers(
  db: D1Database,
  leagueId: string
): Promise<Result<DbLeaguePlayerWithName[]>> {
  try {
    const { results } = await db
      .prepare(`
        SELECT lp.*, p.name, p.avatar_url,
               d.name AS deck_name,
               d.moxfield_url AS deck_moxfield_url,
               d.commander_image_url AS deck_commander_image_url
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        LEFT JOIN decks d ON d.id = lp.deck_id
        WHERE lp.league_id = ?
        ORDER BY p.name ASC
      `)
      .bind(leagueId)
      .all<Record<string, unknown>>()
    return ok(results.map(normalizeLeaguePlayerWithName))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function upsertLeaguePlayer(
  db: D1Database,
  leagueId: string,
  playerId: string,
  data: { deck_id?: string | null }
): Promise<Result<DbLeaguePlayer>> {
  try {
    await db
      .prepare(`
        INSERT INTO league_players (league_id, player_id, deck_id)
        VALUES (?, ?, ?)
        ON CONFLICT(league_id, player_id) DO UPDATE SET
          deck_id = excluded.deck_id
      `)
      .bind(leagueId, playerId, data.deck_id ?? null)
      .run()
    const row = await db
      .prepare('SELECT * FROM league_players WHERE league_id = ? AND player_id = ?')
      .bind(leagueId, playerId)
      .first<Record<string, unknown>>()
    return ok(normalizeLeaguePlayer(row!))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function enrollLeaguePlayer(
  db: D1Database,
  leagueId: string,
  playerId: string
): Promise<Result<DbLeaguePlayer>> {
  try {
    await db
      .prepare('INSERT OR IGNORE INTO league_players (league_id, player_id) VALUES (?, ?)')
      .bind(leagueId, playerId)
      .run()
    const row = await db
      .prepare('SELECT * FROM league_players WHERE league_id = ? AND player_id = ?')
      .bind(leagueId, playerId)
      .first<Record<string, unknown>>()
    return ok(normalizeLeaguePlayer(row!))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function removeLeaguePlayer(
  db: D1Database,
  leagueId: string,
  playerId: string
): Promise<Result<true>> {
  try {
    await db
      .prepare('DELETE FROM league_players WHERE league_id = ? AND player_id = ?')
      .bind(leagueId, playerId)
      .run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── History Detail ─────────────────────────────────────────────────────────────

export async function getLeagueDetail(
  db: D1Database,
  id: string
): Promise<Result<{
  league: DbLeague
  leaguePlayers: DbLeaguePlayerWithName[]
  matches: DbMatch[]
  playoffs: DbPlayoff[]
} | null>> {
  try {
    const leagueRow = await db
      .prepare('SELECT * FROM leagues WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>()
    if (!leagueRow) return ok(null)

    const STAGE_ORDER = ['semi1', 'semi2', 'final', 'third_place']

    const [
      leaguePlayersResult,
      matchesResult,
      playoffsResult,
    ] = await db.batch<Record<string, unknown>>([
      db.prepare(`
        SELECT lp.*, p.name, p.avatar_url,
               d.name AS deck_name,
               d.moxfield_url AS deck_moxfield_url,
               d.commander_image_url AS deck_commander_image_url
        FROM league_players lp
        JOIN players p ON p.id = lp.player_id
        LEFT JOIN decks d ON d.id = lp.deck_id
        WHERE lp.league_id = ?
        ORDER BY p.name ASC
      `).bind(id),
      db.prepare('SELECT * FROM matches WHERE league_id = ? ORDER BY round_number ASC, created_at ASC').bind(id),
      db.prepare('SELECT * FROM playoffs WHERE league_id = ? ORDER BY created_at ASC').bind(id),
    ])

    const matches: DbMatch[] = matchesResult.results.map((row) => ({
      id: row.id as string,
      player1_id: row.player1_id as string,
      player2_id: row.player2_id as string,
      score_p1: row.score_p1 != null ? Number(row.score_p1) : null,
      score_p2: row.score_p2 != null ? Number(row.score_p2) : null,
      is_completed: Number(row.is_completed) === 1,
      round_number: Number(row.round_number),
      created_at: row.created_at as string,
    }))

    const playoffs: DbPlayoff[] = playoffsResult.results
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
      leaguePlayers: leaguePlayersResult.results.map(normalizeLeaguePlayerWithName),
      matches,
      playoffs,
    })
  } catch (e) {
    return err((e as Error).message)
  }
}
