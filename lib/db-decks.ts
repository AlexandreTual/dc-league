import { getDb } from './db'
import crypto from 'crypto'

export type DbDeck = {
  id: string
  player_id: string
  name: string
  commander_image_url: string | null
  moxfield_url: string | null
  created_at: string
}

type Ok<T> = { data: T; error: null }
type Err = { data: null; error: string }
type Result<T> = Ok<T> | Err
function ok<T>(data: T): Ok<T> { return { data, error: null } }
function err(msg: string): Err { return { data: null, error: msg } }
function uuid() { return crypto.randomUUID() }

function normalizeDeck(row: Record<string, unknown>): DbDeck {
  return {
    id: row.id as string,
    player_id: row.player_id as string,
    name: row.name as string,
    commander_image_url: (row.commander_image_url as string) ?? null,
    moxfield_url: (row.moxfield_url as string) ?? null,
    created_at: row.created_at as string,
  }
}

export function listPlayerDecks(playerId: string): Result<DbDeck[]> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM decks WHERE player_id = ? ORDER BY created_at ASC')
      .all(playerId) as Record<string, unknown>[]
    return ok(rows.map(normalizeDeck))
  } catch (e) {
    return err((e as Error).message)
  }
}

export function listAllDecksGrouped(): Result<Record<string, DbDeck[]>> {
  try {
    const rows = getDb()
      .prepare('SELECT * FROM decks ORDER BY player_id, created_at ASC')
      .all() as Record<string, unknown>[]
    const grouped: Record<string, DbDeck[]> = {}
    for (const row of rows) {
      const deck = normalizeDeck(row)
      if (!grouped[deck.player_id]) grouped[deck.player_id] = []
      grouped[deck.player_id].push(deck)
    }
    return ok(grouped)
  } catch (e) {
    return err((e as Error).message)
  }
}

export function insertDeck(
  playerId: string,
  data: { name: string; commander_image_url?: string | null; moxfield_url?: string | null }
): Result<DbDeck> {
  try {
    const id = uuid()
    getDb()
      .prepare('INSERT INTO decks (id, player_id, name, commander_image_url, moxfield_url) VALUES (?, ?, ?, ?, ?)')
      .run(id, playerId, data.name.trim(), data.commander_image_url ?? null, data.moxfield_url ?? null)
    const row = getDb()
      .prepare('SELECT * FROM decks WHERE id = ?')
      .get(id) as Record<string, unknown>
    return ok(normalizeDeck(row))
  } catch (e) {
    return err((e as Error).message)
  }
}
