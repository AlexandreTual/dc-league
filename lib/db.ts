import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

// ── Types ─────────────────────────────────────────────────────────────────────

export type DbPlayer = {
  id: string
  name: string
  moxfield_url: string | null
  avatar_url: string | null
  created_at: string
}

export type DbMatch = {
  id: string
  player1_id: string
  player2_id: string
  score_p1: number | null
  score_p2: number | null
  is_completed: boolean
  round_number: number
  created_at: string
}

export type PlayoffStage = 'semi1' | 'semi2' | 'final' | 'third_place'

export type DbPlayoff = {
  id: string
  stage: PlayoffStage
  player1_id: string | null
  player2_id: string | null
  score_p1: number | null
  score_p2: number | null
  is_completed: boolean
  created_at: string
}

type Ok<T> = { data: T; error: null }
type Err = { data: null; error: string }
type Result<T> = Ok<T> | Err

// ── Singleton DB ──────────────────────────────────────────────────────────────

// Persist across Next.js HMR reloads in dev
const g = global as unknown as { __sqlite?: Database.Database }

export function getDb(): Database.Database {
  if (g.__sqlite) return g.__sqlite

  const dbDir = path.join(process.cwd(), 'data')
  fs.mkdirSync(dbDir, { recursive: true })
  const db = new Database(path.join(dbDir, 'local.db'))
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      moxfield_url TEXT,
      avatar_url   TEXT,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS leagues (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      started_at  TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at    TEXT,
      is_active   INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS decks (
      id                  TEXT PRIMARY KEY,
      player_id           TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      name                TEXT NOT NULL,
      commander_image_url TEXT,
      moxfield_url        TEXT,
      created_at          TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS league_players (
      league_id           TEXT NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      player_id           TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      moxfield_url        TEXT,
      commander_image_url TEXT,
      PRIMARY KEY (league_id, player_id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id           TEXT PRIMARY KEY,
      player1_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      player2_id   TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      score_p1     INTEGER,
      score_p2     INTEGER,
      is_completed INTEGER DEFAULT 0,
      round_number INTEGER DEFAULT 1,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playoffs (
      id           TEXT PRIMARY KEY,
      stage        TEXT NOT NULL,
      player1_id   TEXT REFERENCES players(id) ON DELETE SET NULL,
      player2_id   TEXT REFERENCES players(id) ON DELETE SET NULL,
      score_p1     INTEGER,
      score_p2     INTEGER,
      is_completed INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now'))
    );
  `)

  // Idempotent column migrations
  try { db.prepare('ALTER TABLE matches ADD COLUMN league_id TEXT REFERENCES leagues(id)').run() } catch {}
  try { db.prepare('ALTER TABLE playoffs ADD COLUMN league_id TEXT REFERENCES leagues(id)').run() } catch {}
  try { db.prepare('ALTER TABLE league_players ADD COLUMN deck_id TEXT REFERENCES decks(id)').run() } catch {}

  // Migrate orphaned rows to a default "Saison 1"
  const orphaned = db
    .prepare('SELECT COUNT(*) as n FROM matches WHERE league_id IS NULL')
    .get() as { n: number }

  if (orphaned.n > 0) {
    const legacyId = uuid()
    db.transaction(() => {
      db.prepare(
        `INSERT INTO leagues (id, name, started_at, is_active) VALUES (?, 'Saison 1', datetime('now'), 1)`
      ).run(legacyId)
      db.prepare('UPDATE matches SET league_id = ? WHERE league_id IS NULL').run(legacyId)
      db.prepare('UPDATE playoffs SET league_id = ? WHERE league_id IS NULL').run(legacyId)
      const oldPlayers = db
        .prepare('SELECT id, moxfield_url FROM players WHERE moxfield_url IS NOT NULL')
        .all() as Array<{ id: string; moxfield_url: string }>
      const ins = db.prepare(
        'INSERT OR IGNORE INTO league_players (league_id, player_id, moxfield_url) VALUES (?, ?, ?)'
      )
      for (const p of oldPlayers) ins.run(legacyId, p.id, p.moxfield_url)
    })()
  }

  g.__sqlite = db
  return db
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function uuid() {
  return crypto.randomUUID()
}

function normalizePlayer(row: Record<string, unknown>): DbPlayer {
  return {
    id: row.id as string,
    name: row.name as string,
    moxfield_url: (row.moxfield_url as string) ?? null,
    avatar_url: (row.avatar_url as string) ?? null,
    created_at: row.created_at as string,
  }
}

function normalizeMatch(row: Record<string, unknown>): DbMatch {
  return {
    id: row.id as string,
    player1_id: row.player1_id as string,
    player2_id: row.player2_id as string,
    score_p1: row.score_p1 != null ? Number(row.score_p1) : null,
    score_p2: row.score_p2 != null ? Number(row.score_p2) : null,
    is_completed: Number(row.is_completed) === 1,
    round_number: Number(row.round_number),
    created_at: row.created_at as string,
  }
}

function ok<T>(data: T): Ok<T> {
  return { data, error: null }
}
function err(msg: string): Err {
  return { data: null, error: msg }
}

// ── Players ───────────────────────────────────────────────────────────────────

export function listPlayers(): Result<DbPlayer[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM players ORDER BY created_at ASC')
      .all() as Record<string, unknown>[]
    return ok(rows.map(normalizePlayer))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function countPlayers(): Result<number> {
  try {
    const row = getDb()
      .prepare('SELECT COUNT(*) as n FROM players')
      .get() as { n: number }
    return ok(row.n)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function insertPlayer(data: { name: string }): Result<DbPlayer> {
  try {
    const id = uuid()
    getDb()
      .prepare('INSERT INTO players (id, name) VALUES (?, ?)')
      .run(id, data.name)
    const row = getDb()
      .prepare('SELECT * FROM players WHERE id = ?')
      .get(id) as Record<string, unknown>
    return ok(normalizePlayer(row))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function deletePlayer(id: string): Result<true> {
  try {
    getDb().prepare('DELETE FROM players WHERE id = ?').run(id)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── Matches ───────────────────────────────────────────────────────────────────

export function listMatches(leagueId: string, orderByRound = true): Result<DbMatch[]> {
  try {
    const sql = orderByRound
      ? 'SELECT * FROM matches WHERE league_id = ? ORDER BY round_number ASC, created_at ASC'
      : 'SELECT * FROM matches WHERE league_id = ? ORDER BY created_at ASC'
    const rows = getDb().prepare(sql).all(leagueId) as Record<string, unknown>[]
    return ok(rows.map(normalizeMatch))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function listCompletedMatches(leagueId: string): Result<DbMatch[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM matches WHERE league_id = ? AND is_completed = 1')
      .all(leagueId) as Record<string, unknown>[]
    return ok(rows.map(normalizeMatch))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function countMatches(leagueId: string): Result<number> {
  try {
    const row = getDb()
      .prepare('SELECT COUNT(*) as n FROM matches WHERE league_id = ?')
      .get(leagueId) as { n: number }
    return ok(row.n)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function countCompletedMatches(leagueId: string): Result<number> {
  try {
    const row = getDb()
      .prepare('SELECT COUNT(*) as n FROM matches WHERE league_id = ? AND is_completed = 1')
      .get(leagueId) as { n: number }
    return ok(row.n)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function insertMatches(
  matches: Array<{ player1_id: string; player2_id: string; round_number: number }>,
  leagueId: string
): Result<DbMatch[]> {
  try {
    const db = getDb()
    const insert = db.prepare(
      'INSERT INTO matches (id, player1_id, player2_id, round_number, league_id) VALUES (?, ?, ?, ?, ?)'
    )
    const ids: string[] = []
    db.transaction(() => {
      for (const m of matches) {
        const id = uuid()
        ids.push(id)
        insert.run(id, m.player1_id, m.player2_id, m.round_number, leagueId)
      }
    })()
    const rows = db
      .prepare(`SELECT * FROM matches WHERE id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids) as Record<string, unknown>[]
    return ok(rows.map(normalizeMatch))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function deleteAllMatches(leagueId: string): Result<true> {
  try {
    getDb().prepare('DELETE FROM matches WHERE league_id = ?').run(leagueId)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function updateMatchScore(
  id: string,
  score_p1: number,
  score_p2: number
): Result<DbMatch> {
  try {
    getDb()
      .prepare(
        'UPDATE matches SET score_p1 = ?, score_p2 = ?, is_completed = 1 WHERE id = ?'
      )
      .run(score_p1, score_p2, id)
    const row = getDb()
      .prepare('SELECT * FROM matches WHERE id = ?')
      .get(id) as Record<string, unknown>
    return ok(normalizeMatch(row))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function resetMatchScore(id: string): Result<DbMatch> {
  try {
    getDb()
      .prepare(
        'UPDATE matches SET score_p1 = NULL, score_p2 = NULL, is_completed = 0 WHERE id = ?'
      )
      .run(id)
    const row = getDb()
      .prepare('SELECT * FROM matches WHERE id = ?')
      .get(id) as Record<string, unknown>
    return ok(normalizeMatch(row))
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── Playoffs ──────────────────────────────────────────────────────────────────

function normalizePlayoff(row: Record<string, unknown>): DbPlayoff {
  return {
    id: row.id as string,
    stage: row.stage as PlayoffStage,
    player1_id: (row.player1_id as string) ?? null,
    player2_id: (row.player2_id as string) ?? null,
    score_p1: row.score_p1 != null ? Number(row.score_p1) : null,
    score_p2: row.score_p2 != null ? Number(row.score_p2) : null,
    is_completed: Number(row.is_completed) === 1,
    created_at: row.created_at as string,
  }
}

const STAGE_ORDER: PlayoffStage[] = ['semi1', 'semi2', 'final', 'third_place']

export function listPlayoffs(leagueId: string): Result<DbPlayoff[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM playoffs WHERE league_id = ? ORDER BY created_at ASC')
      .all(leagueId) as Record<string, unknown>[]
    const sorted = rows
      .map(normalizePlayoff)
      .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
    return ok(sorted)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function hasPlayoffs(leagueId: string): Result<boolean> {
  try {
    const row = getDb()
      .prepare('SELECT COUNT(*) as n FROM playoffs WHERE league_id = ?')
      .get(leagueId) as { n: number }
    return ok(row.n > 0)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function generateSemifinals(
  leagueId: string,
  rank1Id: string, rank2Id: string, rank3Id: string, rank4Id: string
): Result<DbPlayoff[]> {
  try {
    const db = getDb()
    const insert = db.prepare(
      'INSERT INTO playoffs (id, stage, player1_id, player2_id, league_id) VALUES (?, ?, ?, ?, ?)'
    )
    const ids: string[] = []
    db.transaction(() => {
      const id1 = uuid(); ids.push(id1)
      insert.run(id1, 'semi1', rank1Id, rank4Id, leagueId)
      const id2 = uuid(); ids.push(id2)
      insert.run(id2, 'semi2', rank2Id, rank3Id, leagueId)
    })()
    const rows = db
      .prepare(`SELECT * FROM playoffs WHERE id IN (${ids.map(() => '?').join(',')})`)
      .all(...ids) as Record<string, unknown>[]
    return ok(rows.map(normalizePlayoff))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function updatePlayoffScore(
  id: string,
  score_p1: number,
  score_p2: number
): Result<{ match: DbPlayoff; generated: DbPlayoff[] }> {
  try {
    const db = getDb()
    db.prepare(
      'UPDATE playoffs SET score_p1 = ?, score_p2 = ?, is_completed = 1 WHERE id = ?'
    ).run(score_p1, score_p2, id)

    const updatedRow = db.prepare('SELECT * FROM playoffs WHERE id = ?')
      .get(id) as Record<string, unknown>
    const updated = normalizePlayoff(updatedRow)
    const leagueId = updatedRow.league_id as string

    let generated: DbPlayoff[] = []
    if (updated.stage === 'semi1' || updated.stage === 'semi2') {
      const semi1 = db.prepare("SELECT * FROM playoffs WHERE stage = 'semi1' AND league_id = ?")
        .get(leagueId) as Record<string, unknown> | undefined
      const semi2 = db.prepare("SELECT * FROM playoffs WHERE stage = 'semi2' AND league_id = ?")
        .get(leagueId) as Record<string, unknown> | undefined
      const finalExists = db
        .prepare("SELECT id FROM playoffs WHERE stage = 'final' AND league_id = ?")
        .get(leagueId)

      if (semi1 && semi2 && !finalExists) {
        const s1 = normalizePlayoff(semi1)
        const s2 = normalizePlayoff(semi2)
        if (s1.is_completed && s2.is_completed) {
          const p1WonSemi1 = (s1.score_p1 ?? 0) > (s1.score_p2 ?? 0)
          const winner1 = p1WonSemi1 ? s1.player1_id : s1.player2_id
          const loser1  = p1WonSemi1 ? s1.player2_id : s1.player1_id
          const p1WonSemi2 = (s2.score_p1 ?? 0) > (s2.score_p2 ?? 0)
          const winner2 = p1WonSemi2 ? s2.player1_id : s2.player2_id
          const loser2  = p1WonSemi2 ? s2.player2_id : s2.player1_id

          const ins = db.prepare(
            'INSERT INTO playoffs (id, stage, player1_id, player2_id, league_id) VALUES (?, ?, ?, ?, ?)'
          )
          const genIds: string[] = []
          db.transaction(() => {
            const fId = uuid(); genIds.push(fId)
            ins.run(fId, 'final', winner1, winner2, leagueId)
            const tId = uuid(); genIds.push(tId)
            ins.run(tId, 'third_place', loser1, loser2, leagueId)
          })()
          const genRows = db
            .prepare(`SELECT * FROM playoffs WHERE id IN (${genIds.map(() => '?').join(',')})`)
            .all(...genIds) as Record<string, unknown>[]
          generated = genRows.map(normalizePlayoff)
        }
      }
    }
    return ok({ match: updated, generated })
  } catch (e) {
    return err((e as Error).message)
  }
}

export function resetPlayoffScore(id: string): Result<DbPlayoff> {
  try {
    getDb()
      .prepare('UPDATE playoffs SET score_p1 = NULL, score_p2 = NULL, is_completed = 0 WHERE id = ?')
      .run(id)
    const row = getDb()
      .prepare('SELECT * FROM playoffs WHERE id = ?')
      .get(id) as Record<string, unknown>
    return ok(normalizePlayoff(row))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function deleteAllPlayoffs(leagueId: string): Result<true> {
  try {
    getDb().prepare('DELETE FROM playoffs WHERE league_id = ?').run(leagueId)
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}
