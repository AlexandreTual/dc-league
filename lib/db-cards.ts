import type { Result } from './db'
import type { CardLookup, CardRow, DeckCardView, Section } from './cards/types'

type Ok<T> = { data: T; error: null }
type Err = { data: null; error: string }
function ok<T>(data: T): Ok<T> { return { data, error: null } }
function err(msg: string): Err { return { data: null, error: msg } }

// D1 limite le nombre de paramètres liés par requête.
const IN_CHUNK = 50

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ')
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeCard(row: Record<string, unknown>): CardRow {
  return {
    id: row.id as string,
    oracle_id: row.oracle_id as string,
    lang: row.lang as string,
    name: row.name as string,
    printed_name: (row.printed_name as string) ?? null,
    set_code: row.set_code as string,
    collector_number: row.collector_number as string,
    released_at: (row.released_at as string) ?? null,
    mana_cost: (row.mana_cost as string) ?? null,
    cmc: Number(row.cmc ?? 0),
    type_line: row.type_line as string,
    printed_type_line: (row.printed_type_line as string) ?? null,
    oracle_text: (row.oracle_text as string) ?? null,
    printed_text: (row.printed_text as string) ?? null,
    colors: parseJson<string[]>(row.colors, []),
    color_identity: parseJson<string[]>(row.color_identity, []),
    image_normal: (row.image_normal as string) ?? null,
    image_small: (row.image_small as string) ?? null,
    faces: parseJson<CardRow['faces']>(row.faces, null),
  }
}

// ── Cache de cartes ───────────────────────────────────────────────────────────

const CARD_COLUMNS = [
  'id', 'oracle_id', 'lang', 'name', 'printed_name', 'set_code', 'collector_number', 'released_at',
  'mana_cost', 'cmc', 'type_line', 'printed_type_line', 'oracle_text', 'printed_text',
  'colors', 'color_identity', 'image_normal', 'image_small', 'faces', 'fetched_at',
] as const

export async function upsertCards(db: D1Database, cards: CardRow[], now: Date): Promise<Result<true>> {
  if (cards.length === 0) return ok(true)
  try {
    const updates = CARD_COLUMNS.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')
    const sql = `INSERT INTO cards (${CARD_COLUMNS.join(', ')}) VALUES (${placeholders(CARD_COLUMNS.length)})
                 ON CONFLICT(id) DO UPDATE SET ${updates}`
    await db.batch(
      cards.map((c) =>
        db.prepare(sql).bind(
          c.id, c.oracle_id, c.lang, c.name, c.printed_name, c.set_code, c.collector_number, c.released_at,
          c.mana_cost, c.cmc, c.type_line, c.printed_type_line, c.oracle_text, c.printed_text,
          JSON.stringify(c.colors), JSON.stringify(c.color_identity), c.image_normal, c.image_small,
          c.faces ? JSON.stringify(c.faces) : null, now.toISOString(),
        ),
      ),
    )
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getCards(db: D1Database, ids: string[]): Promise<Result<Record<string, CardRow>>> {
  try {
    const out: Record<string, CardRow> = {}
    for (const part of chunks([...new Set(ids)], IN_CHUNK)) {
      const { results } = await db
        .prepare(`SELECT * FROM cards WHERE id IN (${placeholders(part.length)})`)
        .bind(...part)
        .all<Record<string, unknown>>()
      for (const row of results) out[row.id as string] = normalizeCard(row)
    }
    return ok(out)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function getLookups(db: D1Database, keys: string[]): Promise<Result<Record<string, CardLookup>>> {
  try {
    const out: Record<string, CardLookup> = {}
    for (const part of chunks([...new Set(keys)], IN_CHUNK)) {
      const { results } = await db
        .prepare(`SELECT key, en_card_id, fr_card_id FROM card_lookups WHERE key IN (${placeholders(part.length)})`)
        .bind(...part)
        .all<Record<string, unknown>>()
      for (const row of results) {
        out[row.key as string] = {
          key: row.key as string,
          en_card_id: (row.en_card_id as string) ?? null,
          fr_card_id: (row.fr_card_id as string) ?? null,
        }
      }
    }
    return ok(out)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function saveLookups(db: D1Database, lookups: CardLookup[], now: Date): Promise<Result<true>> {
  if (lookups.length === 0) return ok(true)
  try {
    await db.batch(
      lookups.map((l) =>
        db
          .prepare('INSERT OR REPLACE INTO card_lookups (key, en_card_id, fr_card_id, fetched_at) VALUES (?, ?, ?, ?)')
          .bind(l.key, l.en_card_id, l.fr_card_id, now.toISOString()),
      ),
    )
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

// ── Contenu des decks ─────────────────────────────────────────────────────────

export type DeckCardInsert = {
  position: number
  quantity: number
  section: Section
  requested_name: string
  requested_set: string | null
  requested_number: string | null
  en_card_id: string | null
  fr_card_id: string | null
}

export async function replaceDeckCards(db: D1Database, deckId: string, rows: DeckCardInsert[]): Promise<Result<true>> {
  try {
    await db.batch([
      db.prepare('DELETE FROM deck_cards WHERE deck_id = ?').bind(deckId),
      ...rows.map((r) =>
        db
          .prepare(
            `INSERT INTO deck_cards (deck_id, position, quantity, section, requested_name, requested_set, requested_number, en_card_id, fr_card_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(deckId, r.position, r.quantity, r.section, r.requested_name, r.requested_set, r.requested_number, r.en_card_id, r.fr_card_id),
      ),
    ])
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function listDeckCards(db: D1Database, deckId: string): Promise<Result<DeckCardView[]>> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM deck_cards WHERE deck_id = ? ORDER BY position ASC')
      .bind(deckId)
      .all<Record<string, unknown>>()
    const ids = results.flatMap((r) => [r.en_card_id, r.fr_card_id]).filter((id): id is string => typeof id === 'string')
    const cards = await getCards(db, ids)
    if (cards.error !== null) return err(cards.error)
    return ok(
      results.map((r) => ({
        position: Number(r.position),
        quantity: Number(r.quantity),
        section: r.section as Section,
        requested_name: r.requested_name as string,
        en: cards.data[r.en_card_id as string] ?? null,
        fr: cards.data[r.fr_card_id as string] ?? null,
      })),
    )
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function countDeckCards(db: D1Database, deckIds: string[]): Promise<Result<Record<string, number>>> {
  try {
    const out: Record<string, number> = {}
    for (const part of chunks([...new Set(deckIds)], IN_CHUNK)) {
      const { results } = await db
        .prepare(`SELECT deck_id, SUM(quantity) AS n FROM deck_cards WHERE deck_id IN (${placeholders(part.length)}) GROUP BY deck_id`)
        .bind(...part)
        .all<{ deck_id: string; n: number }>()
      for (const r of results) out[r.deck_id] = Number(r.n)
    }
    return ok(out)
  } catch (e) {
    return err((e as Error).message)
  }
}

/** Passe une carte légendaire en section commandant et renvoie la carte (FR si disponible) pour l'image. */
export async function setCommander(db: D1Database, deckId: string, position: number): Promise<Result<CardRow>> {
  try {
    const cards = await listDeckCards(db, deckId)
    if (cards.error !== null) return err(cards.error)
    const card = cards.data.find((c) => c.position === position)
    if (!card?.en) return err('NOT_FOUND')
    if (!card.en.type_line.includes('Legendary')) return err('NOT_LEGENDARY')
    await db
      .prepare("UPDATE deck_cards SET section = 'commander' WHERE deck_id = ? AND position = ?")
      .bind(deckId, position)
      .run()
    return ok(card.fr ?? card.en)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function setDeckCommanderImage(db: D1Database, deckId: string, url: string | null): Promise<Result<true>> {
  try {
    await db.prepare('UPDATE decks SET commander_image_url = ? WHERE id = ?').bind(url, deckId).run()
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}
