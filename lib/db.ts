import { chunks, placeholders } from './db-chunks'

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

/** Erreurs métier de la ligue, affichées telles quelles. */
export const ERREURS_LIGUE = {
  matchesExist: 'Les matchs ont déjà été générés.',
  playoffsExist: 'Les playoffs ont déjà été générés.',
  matchNotFound: 'Match introuvable.',
  playoffNotFound: 'Match de playoffs introuvable.',
  leagueClosed: 'La ligue est close : ses scores ne sont plus modifiables.',
  finalScored:
    'La finale ou la petite finale a déjà un score : réinitialise-le avant de changer le vainqueur de cette demi-finale.',
} as const

/** Statut HTTP des erreurs métier de la ligue (pour `resultError` des routes API). */
export const STATUTS_LIGUE: Readonly<Record<string, number>> = {
  [ERREURS_LIGUE.matchNotFound]: 404,
  [ERREURS_LIGUE.playoffNotFound]: 404,
  [ERREURS_LIGUE.matchesExist]: 409,
  [ERREURS_LIGUE.playoffsExist]: 409,
  [ERREURS_LIGUE.leagueClosed]: 409,
  [ERREURS_LIGUE.finalScored]: 409,
}

/** Statut HTTP d'une erreur renvoyée par les fonctions de ligue (500 si elle est inattendue). */
export function statusForError(error: string): number {
  return STATUTS_LIGUE[error] ?? 500
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

/** Condition SQL : la ligue du match n'est pas close (les matchs sans ligue restent modifiables). */
function openLeague(table: 'matches' | 'playoffs'): string {
  return `NOT EXISTS (SELECT 1 FROM leagues l WHERE l.id = ${table}.league_id AND l.is_active = 0)`
}

/** Raison pour laquelle une écriture de score n'a modifié aucune ligne (null si ce n'est ni l'une ni l'autre). */
async function scoreRefusal(db: D1Database, table: 'matches' | 'playoffs', id: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT l.is_active FROM ${table} t LEFT JOIN leagues l ON l.id = t.league_id WHERE t.id = ?`)
    .bind(id)
    .first<{ is_active: number | null }>()
  if (!row) return table === 'matches' ? ERREURS_LIGUE.matchNotFound : ERREURS_LIGUE.playoffNotFound
  if (row.is_active != null && Number(row.is_active) === 0) return ERREURS_LIGUE.leagueClosed
  return null
}

/** Écrit un score si la ligue du match est ouverte, puis relit la ligne. */
async function writeScore(
  db: D1Database,
  table: 'matches' | 'playoffs',
  id: string,
  sets: string,
  values: number[],
): Promise<Result<Record<string, unknown>>> {
  const { meta } = await db
    .prepare(`UPDATE ${table} SET ${sets} WHERE id = ? AND ${openLeague(table)}`)
    .bind(...values, id)
    .run()
  const notFound = table === 'matches' ? ERREURS_LIGUE.matchNotFound : ERREURS_LIGUE.playoffNotFound
  if (!meta.changes) return err((await scoreRefusal(db, table, id)) ?? notFound)
  const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<Record<string, unknown>>()
  return row ? ok(row) : err(notFound)
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

export async function getPlayer(db: D1Database, id: string): Promise<Result<DbPlayer | null>> {
  try {
    const row = await db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<Record<string, unknown>>()
    return ok(row ? normalizePlayer(row) : null)
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

export async function updatePlayerProfile(
  db: D1Database,
  id: string,
  data: { name?: string; avatar_url?: string | null }
): Promise<Result<DbPlayer>> {
  try {
    const sets: string[] = []
    const values: (string | null)[] = []
    if (data.name !== undefined) {
      const name = data.name.trim()
      if (!name) return err('Le nom est requis')
      sets.push('name = ?')
      values.push(name)
    }
    if (data.avatar_url !== undefined) {
      sets.push('avatar_url = ?')
      values.push(data.avatar_url)
    }
    if (sets.length > 0) {
      await db.prepare(`UPDATE players SET ${sets.join(', ')} WHERE id = ?`).bind(...values, id).run()
    }
    const row = await db.prepare('SELECT * FROM players WHERE id = ?').bind(id).first<Record<string, unknown>>()
    return row ? ok(normalizePlayer(row)) : err('Joueur introuvable')
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

export const PLAYER_ERR = {
  HAS_HISTORY: 'Ce joueur a participé à une league et ne peut pas être supprimé.',
  LAST_ADMIN: "Ce joueur est le dernier admin : nomme un autre admin avant de le supprimer.",
} as const

export async function deletePlayer(db: D1Database, id: string): Promise<Result<true>> {
  try {
    const row = await db
      .prepare('SELECT COUNT(*) as n FROM league_players WHERE player_id = ?')
      .bind(id)
      .first<{ n: number }>()
    if ((row?.n ?? 0) > 0) return err(PLAYER_ERR.HAS_HISTORY)
    // Suppression conditionnée en une seule requête : le compte lié (supprimé en cascade)
    // ne doit pas être le dernier admin.
    const r = await db
      .prepare(
        `DELETE FROM players WHERE id = ?1 AND NOT (
           EXISTS (SELECT 1 FROM users WHERE player_id = ?1 AND is_admin = 1)
           AND (SELECT COUNT(*) FROM users WHERE is_admin = 1) <= 1
         )`,
      )
      .bind(id)
      .run()
    if (r.meta.changes === 0) {
      const lastAdmin = await db.prepare('SELECT 1 AS found FROM users WHERE player_id = ? AND is_admin = 1').bind(id).first()
      if (lastAdmin) return err(PLAYER_ERR.LAST_ADMIN)
    }
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
    if (matches.length === 0) return ok([])
    const ids = matches.map(() => uuid())
    // Garde atomique contre le double clic : le premier match n'est inséré que si la ligue n'en a
    // aucun, les suivants seulement si le premier l'a été (le batch est une transaction).
    const stmts = matches.map((m, i) =>
      db
        .prepare(
          `INSERT INTO matches (id, player1_id, player2_id, round_number, league_id) SELECT ?, ?, ?, ?, ? WHERE ${
            i === 0 ? 'NOT EXISTS (SELECT 1 FROM matches WHERE league_id = ?)' : 'EXISTS (SELECT 1 FROM matches WHERE id = ?)'
          }`,
        )
        .bind(ids[i], m.player1_id, m.player2_id, m.round_number, leagueId, i === 0 ? leagueId : ids[0]),
    )
    const [first] = await db.batch(stmts)
    if (!first.meta.changes) return err(ERREURS_LIGUE.matchesExist)
    const rows: Record<string, unknown>[] = []
    for (const part of chunks(ids)) {
      const { results } = await db
        .prepare(`SELECT * FROM matches WHERE id IN (${placeholders(part.length)})`)
        .bind(...part)
        .all<Record<string, unknown>>()
      rows.push(...results)
    }
    return ok(rows.map(normalizeMatch))
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
    const { data, error } = await writeScore(db, 'matches', id, 'score_p1 = ?, score_p2 = ?, is_completed = 1', [score_p1, score_p2])
    return error === null ? ok(normalizeMatch(data)) : err(error)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function resetMatchScore(db: D1Database, id: string): Promise<Result<DbMatch>> {
  try {
    const { data, error } = await writeScore(db, 'matches', id, 'score_p1 = NULL, score_p2 = NULL, is_completed = 0', [])
    return error === null ? ok(normalizeMatch(data)) : err(error)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── Playoffs ──────────────────────────────────────────────────────────────────

const STAGE_ORDER: PlayoffStage[] = ['semi1', 'semi2', 'final', 'third_place']

/** Insertion conditionnelle : la requête se complète par une clause WHERE. */
const INSERT_PLAYOFF = 'INSERT INTO playoffs (id, stage, player1_id, player2_id, league_id) SELECT ?, ?, ?, ?, ?'

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
    // Garde atomique contre le double clic, comme insertMatches.
    const [first] = await db.batch([
      db.prepare(`${INSERT_PLAYOFF} WHERE NOT EXISTS (SELECT 1 FROM playoffs WHERE league_id = ?)`)
        .bind(id1, 'semi1', rank1Id, rank4Id, leagueId, leagueId),
      db.prepare(`${INSERT_PLAYOFF} WHERE EXISTS (SELECT 1 FROM playoffs WHERE id = ?)`)
        .bind(id2, 'semi2', rank2Id, rank3Id, leagueId, id1),
    ])
    if (!first.meta.changes) return err(ERREURS_LIGUE.playoffsExist)
    const { results } = await db
      .prepare('SELECT * FROM playoffs WHERE id IN (?, ?)')
      .bind(id1, id2)
      .all<Record<string, unknown>>()
    return ok(results.map(normalizePlayoff))
  } catch (e) {
    return err((e as Error).message)
  }
}

/** Vainqueur puis perdant d'un match de playoffs joué (pas de nul en playoffs). */
function outcome(p: DbPlayoff): [string | null, string | null] {
  return (p.score_p1 ?? 0) > (p.score_p2 ?? 0) ? [p.player1_id, p.player2_id] : [p.player2_id, p.player1_id]
}

/** Matchs de playoffs d'une ligue, par phase. */
async function playoffsByStage(db: D1Database, leagueId: string): Promise<Map<PlayoffStage, DbPlayoff>> {
  const { results } = await db
    .prepare('SELECT * FROM playoffs WHERE league_id = ?')
    .bind(leagueId)
    .all<Record<string, unknown>>()
  return new Map(results.map(normalizePlayoff).map((p) => [p.stage, p]))
}

/** Joueurs de la finale (vainqueurs) et de la petite finale (perdants) d'après les demi-finales. */
function finalists(s1: DbPlayoff, s2: DbPlayoff): Array<[PlayoffStage, string | null, string | null]> {
  const [winner1, loser1] = outcome(s1)
  const [winner2, loser2] = outcome(s2)
  return [['final', winner1, winner2], ['third_place', loser1, loser2]]
}

export async function updatePlayoffScore(
  db: D1Database,
  id: string,
  score_p1: number,
  score_p2: number
): Promise<Result<{ match: DbPlayoff; generated: DbPlayoff[] }>> {
  try {
    const row = await db
      .prepare('SELECT p.*, l.is_active AS league_active FROM playoffs p LEFT JOIN leagues l ON l.id = p.league_id WHERE p.id = ?')
      .bind(id)
      .first<Record<string, unknown>>()
    if (!row) return err(ERREURS_LIGUE.playoffNotFound)
    if (row.league_active != null && Number(row.league_active) === 0) return err(ERREURS_LIGUE.leagueClosed)
    const current = normalizePlayoff(row)
    const leagueId = (row.league_id as string) ?? null

    // Finale et petite finale existantes à corriger d'après le nouveau score de la demi-finale.
    const brackets: D1PreparedStatement[] = []
    const touched: string[] = []
    let movesFinals = false
    if ((current.stage === 'semi1' || current.stage === 'semi2') && leagueId) {
      const byStage = await playoffsByStage(db, leagueId)
      byStage.set(current.stage, { ...current, score_p1, score_p2, is_completed: true })
      const s1 = byStage.get('semi1')
      const s2 = byStage.get('semi2')
      if (s1?.is_completed && s2?.is_completed) {
        // La finale n'est corrigée que si la demi-finale a bien reçu ce score dans le même batch.
        const semiScored = 'EXISTS (SELECT 1 FROM playoffs WHERE id = ? AND score_p1 = ? AND score_p2 = ? AND is_completed = 1)'
        for (const [stage, p1, p2] of finalists(s1, s2)) {
          const existing = byStage.get(stage)
          // Absente à la lecture : une saisie simultanée peut la créer (puis la jouer) avant notre écriture.
          if (!existing) movesFinals = true
          if (existing && (existing.player1_id !== p1 || existing.player2_id !== p2)) {
            if (existing.is_completed) return err(ERREURS_LIGUE.finalScored)
            movesFinals = true
            touched.push(existing.id)
            brackets.push(
              db.prepare(`UPDATE playoffs SET player1_id = ?, player2_id = ? WHERE id = ? AND is_completed = 0 AND ${semiScored}`)
                .bind(p1, p2, existing.id, id, score_p1, score_p2),
            )
          }
        }
      }
    }

    // Le score n'est écrit que si la ligue est ouverte et, quand la finale change de joueurs ou
    // n'existait pas encore, si ni elle ni la petite finale n'ont reçu de score entre-temps.
    const finalsUnscored = movesFinals
      ? " AND NOT EXISTS (SELECT 1 FROM playoffs x WHERE x.league_id = playoffs.league_id AND x.stage IN ('final', 'third_place') AND x.is_completed = 1)"
      : ''
    const [scoreWrite] = await db.batch([
      db.prepare(`UPDATE playoffs SET score_p1 = ?, score_p2 = ?, is_completed = 1 WHERE id = ? AND ${openLeague('playoffs')}${finalsUnscored}`)
        .bind(score_p1, score_p2, id),
      ...brackets,
    ])
    if (!scoreWrite.meta.changes) {
      return err((await scoreRefusal(db, 'playoffs', id)) ?? ERREURS_LIGUE.finalScored)
    }

    // Après l'écriture du score, on relit : la finale et la petite finale sont créées si elles manquent,
    // ou réalignées (tant qu'elles n'ont pas de score) si une saisie simultanée de l'autre
    // demi-finale les a créées avec des joueurs devenus faux.
    if ((current.stage === 'semi1' || current.stage === 'semi2') && leagueId) {
      const byStage = await playoffsByStage(db, leagueId)
      const s1 = byStage.get('semi1')
      const s2 = byStage.get('semi2')
      if (s1?.is_completed && s2?.is_completed) {
        // Écriture seulement si les demi-finales ont toujours les scores relus et que la ligue est ouverte.
        const unchanged = `EXISTS (SELECT 1 FROM playoffs WHERE id = ? AND is_completed = 1 AND score_p1 = ? AND score_p2 = ?)
          AND EXISTS (SELECT 1 FROM playoffs WHERE id = ? AND is_completed = 1 AND score_p1 = ? AND score_p2 = ?)
          AND NOT EXISTS (SELECT 1 FROM leagues WHERE id = ? AND is_active = 0)`
        const unchangedValues = [s1.id, s1.score_p1, s1.score_p2, s2.id, s2.score_p1, s2.score_p2, leagueId]
        const writes: D1PreparedStatement[] = []
        for (const [stage, p1, p2] of finalists(s1, s2)) {
          const existing = byStage.get(stage)
          if (!existing) {
            const newId = uuid()
            touched.push(newId)
            writes.push(
              db.prepare(`${INSERT_PLAYOFF} WHERE NOT EXISTS (SELECT 1 FROM playoffs WHERE league_id = ? AND stage = ?) AND ${unchanged}`)
                .bind(newId, stage, p1, p2, leagueId, leagueId, stage, ...unchangedValues),
            )
          } else if (!existing.is_completed && (existing.player1_id !== p1 || existing.player2_id !== p2)) {
            if (!touched.includes(existing.id)) touched.push(existing.id)
            writes.push(
              db.prepare(`UPDATE playoffs SET player1_id = ?, player2_id = ? WHERE id = ? AND is_completed = 0 AND ${unchanged}`)
                .bind(p1, p2, existing.id, ...unchangedValues),
            )
          }
        }
        if (writes.length > 0) await db.batch(writes)
      }
    }

    const updatedRow = await db.prepare('SELECT * FROM playoffs WHERE id = ?').bind(id).first<Record<string, unknown>>()
    if (!updatedRow) return err(ERREURS_LIGUE.playoffNotFound)
    let generated: DbPlayoff[] = []
    if (touched.length > 0) {
      const { results } = await db
        .prepare(`SELECT * FROM playoffs WHERE id IN (${placeholders(touched.length)})`)
        .bind(...touched)
        .all<Record<string, unknown>>()
      generated = results.map(normalizePlayoff)
    }
    return ok({ match: normalizePlayoff(updatedRow), generated })
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function resetPlayoffScore(db: D1Database, id: string): Promise<Result<DbPlayoff>> {
  try {
    const { data, error } = await writeScore(db, 'playoffs', id, 'score_p1 = NULL, score_p2 = NULL, is_completed = 0', [])
    return error === null ? ok(normalizePlayoff(data)) : err(error)
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
