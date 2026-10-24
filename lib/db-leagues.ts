import type { Viewer } from './leagues/access'
import { ERREURS_LIGUE } from './db'

// ── Types ─────────────────────────────────────────────────────────────────────

export type LeagueVisibility = 'public' | 'private'

export type DbLeague = {
  id: string
  name: string
  started_at: string
  ended_at: string | null
  is_active: boolean
  /** Organisateur ; null pour une ligue gérée par les admins (ligues d'avant la refonte). */
  owner_player_id: string | null
  owner_name: string | null
  visibility: LeagueVisibility
}

export const LEAGUE_NOT_FOUND = 'Ligue introuvable.'

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
  deck_has_cards: boolean
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
    owner_player_id: (row.owner_player_id as string) ?? null,
    owner_name: (row.owner_name as string) ?? null,
    visibility: row.visibility === 'private' ? 'private' : 'public',
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
    deck_has_cards: Number(row.deck_has_cards) === 1,
  }
}

// ── Leagues ───────────────────────────────────────────────────────────────────

/** Lecture d'une ligue avec le nom de son organisateur. */
const LEAGUE_SELECT = 'SELECT l.*, o.name AS owner_name FROM leagues l LEFT JOIN players o ON o.id = l.owner_player_id'

/** Ligue visible par le visiteur : admin, publique, organisée par lui ou dont il est inscrit. */
const VISIBLE_TO = `(? = 1 OR l.visibility = 'public' OR l.owner_player_id = ?
  OR EXISTS (SELECT 1 FROM league_players vp WHERE vp.league_id = l.id AND vp.player_id = ?))`

const visibleBinds = (viewer: Viewer) => [viewer?.isAdmin ? 1 : 0, viewer?.playerId ?? '', viewer?.playerId ?? '']

/** Toutes les ligues, privées comprises (administration). */
export async function listLeagues(db: D1Database): Promise<Result<DbLeague[]>> {
  try {
    const { results } = await db.prepare(`${LEAGUE_SELECT} ORDER BY l.started_at DESC`).all<Record<string, unknown>>()
    return ok(results.map(normalizeLeague))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getLeague(db: D1Database, id: string): Promise<Result<DbLeague | null>> {
  try {
    const row = await db.prepare(`${LEAGUE_SELECT} WHERE l.id = ?`).bind(id).first<Record<string, unknown>>()
    return ok(row ? normalizeLeague(row) : null)
  } catch (e) {
    return err((e as Error).message)
  }
}

/** Ligues que le visiteur peut voir, la plus récente d'abord. */
export async function listLeaguesFor(db: D1Database, viewer: Viewer): Promise<Result<DbLeague[]>> {
  try {
    const { results } = await db
      .prepare(`${LEAGUE_SELECT} WHERE ${VISIBLE_TO} ORDER BY l.started_at DESC`)
      .bind(...visibleBinds(viewer))
      .all<Record<string, unknown>>()
    return ok(results.map(normalizeLeague))
  } catch (e) {
    return err((e as Error).message)
  }
}

/** Ligue mise en avant : la ligue en cours la plus récente du joueur, sinon la publique en cours la plus récente. */
export async function getFeaturedLeague(db: D1Database, viewer: Viewer): Promise<Result<DbLeague | null>> {
  try {
    const mine = viewer
      ? await db
          .prepare(
            `${LEAGUE_SELECT} WHERE l.is_active = 1 AND (l.owner_player_id = ?
               OR EXISTS (SELECT 1 FROM league_players lp WHERE lp.league_id = l.id AND lp.player_id = ?))
             ORDER BY l.started_at DESC LIMIT 1`,
          )
          .bind(viewer.playerId, viewer.playerId)
          .first<Record<string, unknown>>()
      : null
    const row = mine ?? await db
      .prepare(`${LEAGUE_SELECT} WHERE l.is_active = 1 AND l.visibility = 'public' ORDER BY l.started_at DESC LIMIT 1`)
      .first<Record<string, unknown>>()
    return ok(row ? normalizeLeague(row) : null)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function createLeague(
  db: D1Database,
  data: { name: string; ownerPlayerId: string | null; visibility: LeagueVisibility },
): Promise<Result<DbLeague>> {
  try {
    const id = uuid()
    await db
      .prepare(
        `INSERT INTO leagues (id, name, started_at, is_active, owner_player_id, visibility)
         VALUES (?, ?, datetime('now'), 1, ?, ?)`,
      )
      .bind(id, data.name, data.ownerPlayerId, data.visibility)
      .run()
    const { data: league, error } = await getLeague(db, id)
    return error === null ? ok(league!) : err(error)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function updateLeague(
  db: D1Database,
  id: string,
  data: { name?: string; visibility?: LeagueVisibility },
): Promise<Result<DbLeague>> {
  try {
    const { meta } = await db
      .prepare('UPDATE leagues SET name = COALESCE(?, name), visibility = COALESCE(?, visibility) WHERE id = ?')
      .bind(data.name ?? null, data.visibility ?? null, id)
      .run()
    if (!meta.changes) return err(LEAGUE_NOT_FOUND)
    const { data: league, error } = await getLeague(db, id)
    return error === null ? ok(league!) : err(error)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function isLeagueMember(db: D1Database, leagueId: string, playerId: string): Promise<Result<boolean>> {
  try {
    const row = await db
      .prepare('SELECT 1 FROM league_players WHERE league_id = ? AND player_id = ?')
      .bind(leagueId, playerId)
      .first()
    return ok(!!row)
  } catch (e) {
    return err((e as Error).message)
  }
}

/** Nouveau jeton du lien d'invitation : l'ancien lien cesse de marcher. */
export async function renewInviteToken(db: D1Database, leagueId: string): Promise<Result<string>> {
  try {
    const token = crypto.randomUUID().replaceAll('-', '')
    const { meta } = await db.prepare('UPDATE leagues SET invite_token = ? WHERE id = ?').bind(token, leagueId).run()
    return meta.changes ? ok(token) : err(LEAGUE_NOT_FOUND)
  } catch (e) {
    return err((e as Error).message)
  }
}

/** Jeton actuel du lien d'invitation (null s'il n'a pas encore été créé). */
export async function getInviteToken(db: D1Database, leagueId: string): Promise<Result<string | null>> {
  try {
    const row = await db.prepare('SELECT invite_token FROM leagues WHERE id = ?').bind(leagueId).first<{ invite_token: string | null }>()
    return ok(row?.invite_token ?? null)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getLeagueByInviteToken(db: D1Database, token: string): Promise<Result<DbLeague | null>> {
  if (!token) return ok(null)
  try {
    const row = await db.prepare(`${LEAGUE_SELECT} WHERE l.invite_token = ?`).bind(token).first<Record<string, unknown>>()
    return ok(row ? normalizeLeague(row) : null)
  } catch (e) {
    return err((e as Error).message)
  }
}

/** Matchs de round-robin dont le score est saisi. */
export async function countScoredMatches(db: D1Database, leagueId: string): Promise<Result<number>> {
  try {
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM matches WHERE league_id = ? AND is_completed = 1')
      .bind(leagueId)
      .first<{ n: number }>()
    return ok(Number(row?.n ?? 0))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function deleteLeague(db: D1Database, id: string): Promise<Result<true>> {
  try {
    const existing = await db.prepare('SELECT id FROM leagues WHERE id = ?').bind(id).first()
    if (!existing) return err(LEAGUE_NOT_FOUND)
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
    const { data, error } = await getLeague(db, id)
    return error === null ? ok(data!) : err(error)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── League Players ─────────────────────────────────────────────────────────────

const LEAGUE_PLAYERS_SQL = `
  SELECT lp.*, p.name, p.avatar_url,
         d.name AS deck_name,
         d.moxfield_url AS deck_moxfield_url,
         d.commander_image_url AS deck_commander_image_url,
         EXISTS (SELECT 1 FROM deck_cards dc WHERE dc.deck_id = lp.deck_id) AS deck_has_cards
  FROM league_players lp
  JOIN players p ON p.id = lp.player_id
  LEFT JOIN decks d ON d.id = lp.deck_id
  WHERE lp.league_id = ?
  ORDER BY p.name ASC
`

export async function listLeaguePlayers(
  db: D1Database,
  leagueId: string
): Promise<Result<DbLeaguePlayerWithName[]>> {
  try {
    const { results } = await db
      .prepare(LEAGUE_PLAYERS_SQL)
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
    // Inscription refusée en SQL dès que les matchs existent (génération simultanée comprise).
    await db
      .prepare(
        `INSERT OR IGNORE INTO league_players (league_id, player_id) SELECT ?1, ?2
         WHERE NOT EXISTS (SELECT 1 FROM matches WHERE league_id = ?1)`,
      )
      .bind(leagueId, playerId)
      .run()
    const row = await db
      .prepare('SELECT * FROM league_players WHERE league_id = ? AND player_id = ?')
      .bind(leagueId, playerId)
      .first<Record<string, unknown>>()
    return row ? ok(normalizeLeaguePlayer(row)) : err(ERREURS_LIGUE.matchesExist)
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
    // Désinscription refusée en SQL dès que les matchs existent (génération simultanée comprise).
    const { meta } = await db
      .prepare(
        `DELETE FROM league_players WHERE league_id = ?1 AND player_id = ?2
           AND NOT EXISTS (SELECT 1 FROM matches WHERE league_id = ?1)`,
      )
      .bind(leagueId, playerId)
      .run()
    if (!meta.changes) {
      const generated = await db.prepare('SELECT 1 AS found FROM matches WHERE league_id = ? LIMIT 1').bind(leagueId).first()
      if (generated) return err(ERREURS_LIGUE.matchesExist)
    }
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

/** Ligue d'un match de round-robin ou de playoffs (null si le match n'existe pas). */
export async function getItemLeagueId(
  db: D1Database,
  table: 'matches' | 'playoffs',
  id: string,
): Promise<Result<string | null>> {
  try {
    const row = await db.prepare(`SELECT league_id FROM ${table} WHERE id = ?`).bind(id).first<{ league_id: string | null }>()
    return ok(row?.league_id ?? null)
  } catch (e) {
    return err((e as Error).message)
  }
}

/** Ligues dont le joueur est inscrit ou organisateur. */
export async function listMyLeagueIds(db: D1Database, playerId: string): Promise<Result<string[]>> {
  try {
    const { results } = await db
      .prepare(
        `SELECT id FROM leagues WHERE owner_player_id = ?1
         UNION SELECT league_id AS id FROM league_players WHERE player_id = ?1`,
      )
      .bind(playerId)
      .all<{ id: string }>()
    return ok(results.map((r) => r.id))
  } catch (e) {
    return err((e as Error).message)
  }
}
