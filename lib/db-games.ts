// Salon du jeu en ligne : tables et places. Utilisé par le site et par le Worker de jeu (imports relatifs).
import type { Result } from './db'
import type { Format } from './game/types'

export type TableStatus = 'open' | 'playing' | 'finished'

export type GameTablePlayer = { playerId: string; name: string; deckId: string | null; deckName: string | null; seat: number }

export type GameTable = {
  id: string
  hostPlayerId: string
  format: Format
  seats: number
  eliminatedSeeAll: boolean
  status: TableStatus
  winnerPlayerId: string | null
  createdAt: string
  lastActivityAt: string
  players: GameTablePlayer[]
}

export const INTERNAL_ERROR = 'Erreur interne, réessaie plus tard'

const ERR = {
  notFound: 'Table introuvable',
  full: 'Table complète',
  started: 'La partie a déjà commencé',
  notHost: "Seul l'hôte peut faire ça",
  notYourDeck: "Ce deck n'est pas à toi",
  notSeated: "Tu n'es pas à cette table",
  tooFew: 'Il faut au moins 2 joueurs',
  duel: 'En Duel, il faut exactement 2 joueurs',
  decks: 'Chaque joueur doit choisir un deck',
}

const ok = <T>(data: T): Result<T> => ({ data, error: null })
const fail = <T>(error: string): Result<T> => ({ data: null, error })

/** Format des dates SQLite (`datetime('now')`) pour comparer sans ambiguïté. */
const sqlTime = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')

async function guard<T>(run: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await run()
  } catch (e) {
    console.error('Salon : erreur de base de données', e)
    return fail(INTERNAL_ERROR)
  }
}

async function loadPlayers(db: D1Database, tableIds: string[]): Promise<Map<string, GameTablePlayer[]>> {
  const byTable = new Map<string, GameTablePlayer[]>(tableIds.map((id) => [id, []]))
  if (tableIds.length === 0) return byTable
  const { results } = await db
    .prepare(
      `SELECT s.table_id, s.player_id, p.name, s.deck_id, d.name AS deck_name, s.seat
       FROM game_seats s JOIN players p ON p.id = s.player_id LEFT JOIN decks d ON d.id = s.deck_id
       WHERE s.table_id IN (${tableIds.map(() => '?').join(', ')}) ORDER BY s.seat`,
    )
    .bind(...tableIds)
    .all<Record<string, unknown>>()
  for (const r of results) {
    byTable.get(r.table_id as string)!.push({
      playerId: r.player_id as string,
      name: r.name as string,
      deckId: (r.deck_id as string) ?? null,
      deckName: (r.deck_name as string) ?? null,
      seat: Number(r.seat),
    })
  }
  return byTable
}

function normalize(row: Record<string, unknown>, players: GameTablePlayer[]): GameTable {
  return {
    id: row.id as string,
    hostPlayerId: row.host_player_id as string,
    format: row.format as Format,
    seats: Number(row.seats),
    eliminatedSeeAll: !!row.eliminated_see_all,
    status: row.status as TableStatus,
    winnerPlayerId: (row.winner_player_id as string) ?? null,
    createdAt: row.created_at as string,
    lastActivityAt: row.last_activity_at as string,
    players,
  }
}

export async function getTable(db: D1Database, id: string): Promise<Result<GameTable | null>> {
  return guard(async () => {
    const row = await db.prepare('SELECT * FROM game_tables WHERE id = ?').bind(id).first<Record<string, unknown>>()
    if (!row) return ok(null)
    return ok(normalize(row, (await loadPlayers(db, [id])).get(id)!))
  })
}

/** Table existante et encore ouverte, sinon l'erreur à renvoyer. */
async function openTable(db: D1Database, id: string): Promise<Result<GameTable>> {
  const { data, error } = await getTable(db, id)
  if (error !== null) return fail(error)
  if (!data) return fail(ERR.notFound)
  if (data.status !== 'open') return fail(ERR.started)
  return ok(data)
}

async function reload(db: D1Database, id: string): Promise<Result<GameTable>> {
  const { data, error } = await getTable(db, id)
  if (error !== null) return fail(error)
  return data ? ok(data) : fail(ERR.notFound)
}

export async function createTable(
  db: D1Database,
  input: { hostPlayerId: string; format: Format; seats: number; eliminatedSeeAll: boolean },
): Promise<Result<GameTable>> {
  return guard(async () => {
    const id = crypto.randomUUID()
    const seats = input.format === 'duel' ? 2 : Math.min(5, Math.max(2, Math.floor(input.seats)))
    await db.batch([
      db
        .prepare('INSERT INTO game_tables (id, host_player_id, format, seats, eliminated_see_all) VALUES (?, ?, ?, ?, ?)')
        .bind(id, input.hostPlayerId, input.format, seats, input.eliminatedSeeAll ? 1 : 0),
      db.prepare('INSERT INTO game_seats (table_id, player_id, seat) VALUES (?, ?, 1)').bind(id, input.hostPlayerId),
    ])
    return reload(db, id)
  })
}

/** Tables ouvertes ou en cours, les plus récentes d'abord. */
export async function listTables(db: D1Database): Promise<Result<GameTable[]>> {
  return guard(async () => {
    const { results } = await db
      .prepare("SELECT * FROM game_tables WHERE status IN ('open', 'playing') ORDER BY created_at DESC, rowid DESC")
      .all<Record<string, unknown>>()
    const players = await loadPlayers(db, results.map((r) => r.id as string))
    return ok(results.map((r) => normalize(r, players.get(r.id as string)!)))
  })
}

export async function joinTable(db: D1Database, id: string, playerId: string): Promise<Result<GameTable>> {
  return guard(async () => {
    const { data: table, error } = await openTable(db, id)
    if (error !== null) return fail(error)
    if (table.players.some((p) => p.playerId === playerId)) return ok(table)
    if (table.players.length >= table.seats) return fail(ERR.full)
    const seat = Math.max(0, ...table.players.map((p) => p.seat)) + 1
    await db.prepare('INSERT INTO game_seats (table_id, player_id, seat) VALUES (?, ?, ?)').bind(id, playerId, seat).run()
    return reload(db, id)
  })
}

/** Quitte une table ouverte. L'hôte qui part cède sa place au joueur suivant ; une table vide est supprimée. */
export async function leaveTable(db: D1Database, id: string, playerId: string): Promise<Result<GameTable | null>> {
  return guard(async () => {
    const { data: table, error } = await openTable(db, id)
    if (error !== null) return fail(error)
    const rest = table.players.filter((p) => p.playerId !== playerId)
    if (rest.length === 0) {
      await deleteTable(db, id)
      return ok(null)
    }
    const statements = [db.prepare('DELETE FROM game_seats WHERE table_id = ? AND player_id = ?').bind(id, playerId)]
    if (table.hostPlayerId === playerId) {
      statements.push(db.prepare('UPDATE game_tables SET host_player_id = ? WHERE id = ?').bind(rest[0].playerId, id))
    }
    await db.batch(statements)
    return reload(db, id)
  })
}

export async function removeSeat(db: D1Database, id: string, hostId: string, playerId: string): Promise<Result<GameTable>> {
  return guard(async () => {
    const { data: table, error } = await openTable(db, id)
    if (error !== null) return fail(error)
    if (table.hostPlayerId !== hostId || playerId === hostId) return fail(ERR.notHost)
    await db.prepare('DELETE FROM game_seats WHERE table_id = ? AND player_id = ?').bind(id, playerId).run()
    return reload(db, id)
  })
}

export async function chooseDeck(db: D1Database, id: string, playerId: string, deckId: string): Promise<Result<GameTable>> {
  return guard(async () => {
    const { data: table, error } = await openTable(db, id)
    if (error !== null) return fail(error)
    if (!table.players.some((p) => p.playerId === playerId)) return fail(ERR.notSeated)
    const deck = await db.prepare('SELECT player_id FROM decks WHERE id = ?').bind(deckId).first<{ player_id: string }>()
    if (deck?.player_id !== playerId) return fail(ERR.notYourDeck)
    await db.prepare('UPDATE game_seats SET deck_id = ? WHERE table_id = ? AND player_id = ?').bind(deckId, id, playerId).run()
    return reload(db, id)
  })
}

/** Raison pour laquelle la partie ne peut pas démarrer, ou null. */
export function startCheck(table: GameTable): string | null {
  if (table.status !== 'open') return ERR.started
  if (table.players.length < 2) return ERR.tooFew
  if (table.format === 'duel' && table.players.length !== 2) return ERR.duel
  if (table.players.some((p) => p.deckId === null)) return ERR.decks
  return null
}

async function run(db: D1Database, sql: string, ...params: unknown[]): Promise<Result<null>> {
  return guard(async () => {
    await db.prepare(sql).bind(...params).run()
    return ok(null)
  })
}

export const markPlaying = (db: D1Database, id: string) =>
  run(db, "UPDATE game_tables SET status = 'playing', last_activity_at = datetime('now') WHERE id = ?", id)

export const touchActivity = (db: D1Database, id: string, now: Date) =>
  run(db, 'UPDATE game_tables SET last_activity_at = ? WHERE id = ?', sqlTime(now), id)

export const finishTable = (db: D1Database, id: string, winner: string | null) =>
  run(db, "UPDATE game_tables SET status = 'finished', winner_player_id = ? WHERE id = ?", winner, id)

export const setHost = (db: D1Database, id: string, playerId: string) =>
  run(db, 'UPDATE game_tables SET host_player_id = ? WHERE id = ?', playerId, id)

export async function deleteTable(db: D1Database, id: string): Promise<Result<null>> {
  return guard(async () => {
    await db.batch([
      db.prepare('DELETE FROM game_seats WHERE table_id = ?').bind(id),
      db.prepare('DELETE FROM game_tables WHERE id = ?').bind(id),
    ])
    return ok(null)
  })
}

/** Tables (tous statuts) sans activité depuis `before`. */
export async function staleTables(db: D1Database, before: Date): Promise<Result<string[]>> {
  return guard(async () => {
    const { results } = await db.prepare('SELECT id FROM game_tables WHERE last_activity_at < ?').bind(sqlTime(before)).all<{ id: string }>()
    return ok(results.map((r) => r.id))
  })
}
