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
export type Result<T> = Ok<T> | Err

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

function ok<T>(data: T): Ok<T> {
  return { data, error: null }
}
function err(msg: string): Err {
  return { data: null, error: msg }
}

// ── Players ───────────────────────────────────────────────────────────────────

export async function listPlayers(db: D1Database): Promise<Result<DbPlayer[]>> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM players ORDER BY created_at ASC')
      .all<Record<string, unknown>>()
    return ok(results.map(normalizePlayer))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function countPlayers(db: D1Database): Promise<Result<number>> {
  try {
    const row = await db.prepare('SELECT COUNT(*) as n FROM players').first<{ n: number }>()
    return ok(row?.n ?? 0)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function insertPlayer(db: D1Database, data: { name: string }): Promise<Result<DbPlayer>> {
  try {
    const id = uuid()
    await db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, data.name).run()
    const row = await db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<Record<string, unknown>>()
    return ok(normalizePlayer(row!))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getPlayerIdsWithHistory(db: D1Database): Promise<Result<string[]>> {
  try {
    const { results } = await db
      .prepare('SELECT DISTINCT player_id FROM league_players')
      .all<{ player_id: string }>()
    return ok(results.map((r) => r.player_id))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deletePlayer(db: D1Database, id: string): Promise<Result<true>> {
  try {
    const row = await db
      .prepare('SELECT COUNT(*) as n FROM league_players WHERE player_id = ?')
      .bind(id)
      .first<{ n: number }>()
    if ((row?.n ?? 0) > 0) {
      return err('Ce joueur a participé à une league et ne peut pas être supprimé.')
    }
    await db.prepare('DELETE FROM players WHERE id = ?').bind(id).run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── Matches ───────────────────────────────────────────────────────────────────

export async function listMatches(
  db: D1Database,
  leagueId: string,
  orderByRound = true
): Promise<Result<DbMatch[]>> {
  try {
    const sql = orderByRound
      ? 'SELECT * FROM matches WHERE league_id = ? ORDER BY round_number ASC, created_at ASC'
      : 'SELECT * FROM matches WHERE league_id = ? ORDER BY created_at ASC'
    const { results } = await db.prepare(sql).bind(leagueId).all<Record<string, unknown>>()
    return ok(results.map(normalizeMatch))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function listCompletedMatches(db: D1Database, leagueId: string): Promise<Result<DbMatch[]>> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM matches WHERE league_id = ? AND is_completed = 1')
      .bind(leagueId)
      .all<Record<string, unknown>>()
    return ok(results.map(normalizeMatch))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function countMatches(db: D1Database, leagueId: string): Promise<Result<number>> {
  try {
    const row = await db
      .prepare('SELECT COUNT(*) as n FROM matches WHERE league_id = ?')
      .bind(leagueId)
      .first<{ n: number }>()
    return ok(row?.n ?? 0)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function countCompletedMatches(db: D1Database, leagueId: string): Promise<Result<number>> {
  try {
    const row = await db
      .prepare('SELECT COUNT(*) as n FROM matches WHERE league_id = ? AND is_completed = 1')
      .bind(leagueId)
      .first<{ n: number }>()
    return ok(row?.n ?? 0)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function insertMatches(
  db: D1Database,
  matches: Array<{ player1_id: string; player2_id: string; round_number: number }>,
  leagueId: string
): Promise<Result<DbMatch[]>> {
  try {
    const ids: string[] = []
    const stmts = matches.map((m) => {
      const id = uuid()
      ids.push(id)
      return db
        .prepare('INSERT INTO matches (id, player1_id, player2_id, round_number, league_id) VALUES (?, ?, ?, ?, ?)')
        .bind(id, m.player1_id, m.player2_id, m.round_number, leagueId)
    })
    await db.batch(stmts)
    const placeholders = ids.map(() => '?').join(',')
    const { results } = await db
      .prepare(`SELECT * FROM matches WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all<Record<string, unknown>>()
    return ok(results.map(normalizeMatch))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deleteAllMatches(db: D1Database, leagueId: string): Promise<Result<true>> {
  try {
    await db.prepare('DELETE FROM matches WHERE league_id = ?').bind(leagueId).run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function updateMatchScore(
  db: D1Database,
  id: string,
  score_p1: number,
  score_p2: number
): Promise<Result<DbMatch>> {
  try {
    await db
      .prepare('UPDATE matches SET score_p1 = ?, score_p2 = ?, is_completed = 1 WHERE id = ?')
      .bind(score_p1, score_p2, id)
      .run()
    const row = await db.prepare('SELECT * FROM matches WHERE id = ?').bind(id).first<Record<string, unknown>>()
    return ok(normalizeMatch(row!))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function resetMatchScore(db: D1Database, id: string): Promise<Result<DbMatch>> {
  try {
    await db
      .prepare('UPDATE matches SET score_p1 = NULL, score_p2 = NULL, is_completed = 0 WHERE id = ?')
      .bind(id)
      .run()
    const row = await db.prepare('SELECT * FROM matches WHERE id = ?').bind(id).first<Record<string, unknown>>()
    return ok(normalizeMatch(row!))
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── Playoffs ──────────────────────────────────────────────────────────────────

const STAGE_ORDER: PlayoffStage[] = ['semi1', 'semi2', 'final', 'third_place']

export async function listPlayoffs(db: D1Database, leagueId: string): Promise<Result<DbPlayoff[]>> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM playoffs WHERE league_id = ? ORDER BY created_at ASC')
      .bind(leagueId)
      .all<Record<string, unknown>>()
    const sorted = results
      .map(normalizePlayoff)
      .sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage))
    return ok(sorted)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function hasPlayoffs(db: D1Database, leagueId: string): Promise<Result<boolean>> {
  try {
    const row = await db
      .prepare('SELECT COUNT(*) as n FROM playoffs WHERE league_id = ?')
      .bind(leagueId)
      .first<{ n: number }>()
    return ok((row?.n ?? 0) > 0)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function generateSemifinals(
  db: D1Database,
  leagueId: string,
  rank1Id: string,
  rank2Id: string,
  rank3Id: string,
  rank4Id: string
): Promise<Result<DbPlayoff[]>> {
  try {
    const id1 = uuid()
    const id2 = uuid()
    await db.batch([
      db.prepare('INSERT INTO playoffs (id, stage, player1_id, player2_id, league_id) VALUES (?, ?, ?, ?, ?)')
        .bind(id1, 'semi1', rank1Id, rank4Id, leagueId),
      db.prepare('INSERT INTO playoffs (id, stage, player1_id, player2_id, league_id) VALUES (?, ?, ?, ?, ?)')
        .bind(id2, 'semi2', rank2Id, rank3Id, leagueId),
    ])
    const { results } = await db
      .prepare('SELECT * FROM playoffs WHERE id IN (?, ?)')
      .bind(id1, id2)
      .all<Record<string, unknown>>()
    return ok(results.map(normalizePlayoff))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function updatePlayoffScore(
  db: D1Database,
  id: string,
  score_p1: number,
  score_p2: number
): Promise<Result<{ match: DbPlayoff; generated: DbPlayoff[] }>> {
  try {
    await db
      .prepare('UPDATE playoffs SET score_p1 = ?, score_p2 = ?, is_completed = 1 WHERE id = ?')
      .bind(score_p1, score_p2, id)
      .run()

    const updatedRow = await db
      .prepare('SELECT * FROM playoffs WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>()
    if (!updatedRow) return err('Playoff introuvable')
    const updated = normalizePlayoff(updatedRow)
    const leagueId = updatedRow.league_id as string

    let generated: DbPlayoff[] = []
    if (updated.stage === 'semi1' || updated.stage === 'semi2') {
      const [semi1Result, semi2Result, finalResult] = await db.batch<Record<string, unknown>>([
        db.prepare("SELECT * FROM playoffs WHERE stage = 'semi1' AND league_id = ?").bind(leagueId),
        db.prepare("SELECT * FROM playoffs WHERE stage = 'semi2' AND league_id = ?").bind(leagueId),
        db.prepare("SELECT id FROM playoffs WHERE stage = 'final' AND league_id = ?").bind(leagueId),
      ])

      const semi1 = semi1Result.results[0]
      const semi2 = semi2Result.results[0]
      const finalExists = finalResult.results.length > 0

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

          const fId = uuid()
          const tId = uuid()
          await db.batch([
            db.prepare('INSERT INTO playoffs (id, stage, player1_id, player2_id, league_id) VALUES (?, ?, ?, ?, ?)')
              .bind(fId, 'final', winner1, winner2, leagueId),
            db.prepare('INSERT INTO playoffs (id, stage, player1_id, player2_id, league_id) VALUES (?, ?, ?, ?, ?)')
              .bind(tId, 'third_place', loser1, loser2, leagueId),
          ])
          const { results: genRows } = await db
            .prepare('SELECT * FROM playoffs WHERE id IN (?, ?)')
            .bind(fId, tId)
            .all<Record<string, unknown>>()
          generated = genRows.map(normalizePlayoff)
        }
      }
    }
    return ok({ match: updated, generated })
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function resetPlayoffScore(db: D1Database, id: string): Promise<Result<DbPlayoff>> {
  try {
    await db
      .prepare('UPDATE playoffs SET score_p1 = NULL, score_p2 = NULL, is_completed = 0 WHERE id = ?')
      .bind(id)
      .run()
    const row = await db.prepare('SELECT * FROM playoffs WHERE id = ?').bind(id).first<Record<string, unknown>>()
    return ok(normalizePlayoff(row!))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deleteAllPlayoffs(db: D1Database, leagueId: string): Promise<Result<true>> {
  try {
    await db.prepare('DELETE FROM playoffs WHERE league_id = ?').bind(leagueId).run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}
