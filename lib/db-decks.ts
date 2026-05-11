
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

export async function listPlayerDecks(db: D1Database, playerId: string): Promise<Result<DbDeck[]>> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM decks WHERE player_id = ? ORDER BY created_at ASC')
      .bind(playerId)
      .all<Record<string, unknown>>()
    return ok(results.map(normalizeDeck))
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function listAllDecksGrouped(db: D1Database): Promise<Result<Record<string, DbDeck[]>>> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM decks ORDER BY player_id, created_at ASC')
      .all<Record<string, unknown>>()
    const grouped: Record<string, DbDeck[]> = {}
    for (const row of results) {
      const deck = normalizeDeck(row)
      if (!grouped[deck.player_id]) grouped[deck.player_id] = []
      grouped[deck.player_id].push(deck)
    }
    return ok(grouped)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function insertDeck(
  db: D1Database,
  playerId: string,
  data: { name: string; commander_image_url?: string | null; moxfield_url?: string | null }
): Promise<Result<DbDeck>> {
  try {
    const id = uuid()
    await db
      .prepare('INSERT INTO decks (id, player_id, name, commander_image_url, moxfield_url) VALUES (?, ?, ?, ?, ?)')
      .bind(id, playerId, data.name.trim(), data.commander_image_url ?? null, data.moxfield_url ?? null)
      .run()
    const row = await db.prepare('SELECT * FROM decks WHERE id = ?').bind(id).first<Record<string, unknown>>()
    return ok(normalizeDeck(row!))
  } catch (e) {
    return err((e as Error).message)
  }
}
