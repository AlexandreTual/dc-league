import type { Result } from './db'
import type { CardLookup, CardRow, DeckCardView, DeckTokenRow, Ruling, Section, StoredCardLookup } from './cards/types'
import type { DeckToken } from './game/types'

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
    image_large: (row.image_large as string) ?? null,
    image_small: (row.image_small as string) ?? null,
    faces: parseJson<CardRow['faces']>(row.faces, null),
  }
}

// ── Cache de cartes ───────────────────────────────────────────────────────────

function cardValues(c: CardRow, now: Date): Record<string, unknown> {
  return {
    id: c.id, oracle_id: c.oracle_id, lang: c.lang, name: c.name, printed_name: c.printed_name,
    set_code: c.set_code, collector_number: c.collector_number, released_at: c.released_at,
    mana_cost: c.mana_cost, cmc: c.cmc, type_line: c.type_line, printed_type_line: c.printed_type_line,
    oracle_text: c.oracle_text, printed_text: c.printed_text,
    colors: JSON.stringify(c.colors), color_identity: JSON.stringify(c.color_identity),
    image_normal: c.image_normal, image_large: c.image_large ?? null, image_small: c.image_small,
    faces: c.faces ? JSON.stringify(c.faces) : null, fetched_at: now.toISOString(),
  }
}

/** Colonnes ajoutées par une migration récente : le site peut tourner une ou deux minutes avant elle. */
const RECENT_COLUMNS = ['image_large']

async function writeCards(db: D1Database, cards: CardRow[], now: Date, columns: string[]) {
  const updates = columns.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`).join(', ')
  const sql = `INSERT INTO cards (${columns.join(', ')}) VALUES (${placeholders(columns.length)})
               ON CONFLICT(id) DO UPDATE SET ${updates}`
  await db.batch(cards.map((c) => {
    const values = cardValues(c, now)
    return db.prepare(sql).bind(...columns.map((col) => values[col]))
  }))
}

export async function upsertCards(db: D1Database, cards: CardRow[], now: Date): Promise<Result<true>> {
  if (cards.length === 0) return ok(true)
  const columns = Object.keys(cardValues(cards[0], now))
  try {
    await writeCards(db, cards, now, columns)
    return ok(true)
  } catch (e) {
    const message = (e as Error).message
    if (!RECENT_COLUMNS.some((c) => message.includes(c))) return err(message)
    // Base pas encore migrée : on enregistre sans les nouvelles colonnes plutôt que de faire échouer l'import.
    try {
      await writeCards(db, cards, now, columns.filter((c) => !RECENT_COLUMNS.includes(c)))
      return ok(true)
    } catch (e2) {
      return err((e2 as Error).message)
    }
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

export async function getLookups(db: D1Database, keys: string[]): Promise<Result<Record<string, StoredCardLookup>>> {
  try {
    const out: Record<string, StoredCardLookup> = {}
    for (const part of chunks([...new Set(keys)], IN_CHUNK)) {
      const { results } = await db
        .prepare(`SELECT key, en_card_id, fr_card_id, fetched_at FROM card_lookups WHERE key IN (${placeholders(part.length)})`)
        .bind(...part)
        .all<Record<string, unknown>>()
      for (const row of results) {
        out[row.key as string] = {
          key: row.key as string,
          en_card_id: (row.en_card_id as string) ?? null,
          fr_card_id: (row.fr_card_id as string) ?? null,
          fetched_at: row.fetched_at as string,
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

// ── Règles (rulings) ──────────────────────────────────────────────────────────

/** Une impression en cache de la carte (anglaise de préférence), ou null si la carte est inconnue. */
export async function findCardIdByOracle(db: D1Database, oracleId: string): Promise<Result<string | null>> {
  try {
    const id = await db
      .prepare("SELECT id FROM cards WHERE oracle_id = ? ORDER BY lang = 'en' DESC LIMIT 1")
      .bind(oracleId)
      .first<string>('id')
    return ok(id ?? null)
  } catch (e) {
    return err((e as Error).message)
  }
}

export type StoredRulings = { rulings: Ruling[]; fetched_at: string }

export async function getStoredRulings(db: D1Database, oracleId: string): Promise<Result<StoredRulings | null>> {
  try {
    const row = await db
      .prepare('SELECT rulings, fetched_at FROM card_rulings WHERE oracle_id = ?')
      .bind(oracleId)
      .first<{ rulings: string; fetched_at: string }>()
    return ok(row ? { rulings: parseJson<Ruling[]>(row.rulings, []), fetched_at: row.fetched_at } : null)
  } catch (e) {
    return err((e as Error).message)
  }
}

export async function saveRulings(db: D1Database, oracleId: string, rulings: Ruling[], now: Date): Promise<Result<true>> {
  try {
    await db
      .prepare('INSERT OR REPLACE INTO card_rulings (oracle_id, rulings, fetched_at) VALUES (?, ?, ?)')
      .bind(oracleId, JSON.stringify(rulings), now.toISOString())
      .run()
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

// ── Jetons des decks ──────────────────────────────────────────────────────────

/** Remplace la liste des jetons d'un deck. */
export async function replaceDeckTokens(db: D1Database, deckId: string, tokens: DeckTokenRow[]): Promise<Result<true>> {
  try {
    await db.batch([
      db.prepare('DELETE FROM deck_tokens WHERE deck_id = ?').bind(deckId),
      ...tokens.map((t) =>
        db
          .prepare(
            `INSERT OR REPLACE INTO deck_tokens (deck_id, token_scryfall_id, name, type_line, power, toughness, colors, image, source_names)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(deckId, t.id, t.name, t.typeLine, t.power, t.toughness, JSON.stringify(t.colors), t.image, JSON.stringify(t.sources)),
      ),
    ])
    return ok(true)
  } catch (e) {
    return err((e as Error).message)
  }
}

/** Jetons d'un deck, triés par nom. */
export async function listDeckTokens(db: D1Database, deckId: string): Promise<Result<DeckToken[]>> {
  try {
    const { results } = await db
      .prepare('SELECT * FROM deck_tokens WHERE deck_id = ? ORDER BY name COLLATE NOCASE ASC')
      .bind(deckId)
      .all<Record<string, unknown>>()
    return ok(
      results.map((r) => ({
        name: r.name as string,
        typeLine: r.type_line as string,
        power: (r.power as string) ?? null,
        toughness: (r.toughness as string) ?? null,
        colors: parseJson<string[]>(r.colors, []),
        image: (r.image as string) ?? null,
        sources: parseJson<string[]>(r.source_names, []),
      })),
    )
  } catch (e) {
    return err((e as Error).message)
  }
}
