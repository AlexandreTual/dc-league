// Adaptateur minimal imitant l'API D1 au-dessus de node:sqlite, pour les tests.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')

type Sqlite = InstanceType<typeof DatabaseSync>
type Value = string | number | bigint | null | Uint8Array

export const MIGRATIONS = [
  '0001_schema.sql',
  '0002_accounts.sql',
  '0003_deck_cards.sql',
  '0004_game_tables.sql',
  '0005_email.sql',
  '0006_table_starting.sql',
  '0007_ligue_index.sql',
  '0008_deck_tokens.sql',
  '0009_card_rulings.sql',
  '0010_card_images.sql',
  '0011_card_image_large.sql',
  '0012_game_timing.sql',
]

/** D1 refuse une requête qui lie plus de 100 paramètres. */
export const MAX_BOUND_PARAMETERS = 100

class Statement {
  constructor(
    private readonly sqlite: Sqlite,
    readonly sql: string,
    readonly values: Value[] = [],
  ) {}

  bind(...values: unknown[]): Statement {
    return new Statement(this.sqlite, this.sql, values.map(toValue))
  }

  /** Même refus que D1 au-delà de 100 paramètres liés. */
  private checkLimit() {
    if (this.values.length > MAX_BOUND_PARAMETERS) {
      throw new Error(`too many SQL variables at offset ${MAX_BOUND_PARAMETERS}: SQLITE_ERROR`)
    }
  }

  async first<T>(column?: string): Promise<T | null> {
    this.checkLimit()
    const row = this.sqlite.prepare(this.sql).get(...this.values) as Record<string, unknown> | undefined
    if (!row) return null
    return (column ? row[column] : row) as T
  }

  async all<T>(): Promise<{ results: T[]; success: true }> {
    this.checkLimit()
    const rows = this.sqlite.prepare(this.sql).all(...this.values) as T[]
    return { results: rows, success: true }
  }

  async run(): Promise<{ success: true; meta: { changes: number; last_row_id: number } }> {
    return this.execute()
  }

  execute() {
    this.checkLimit()
    // Comme D1, un batch renvoie les lignes des requêtes de lecture.
    if (/^\s*(SELECT|WITH)\b/i.test(this.sql)) {
      const results = this.sqlite.prepare(this.sql).all(...this.values)
      return { success: true as const, results, meta: { changes: 0, last_row_id: 0 } }
    }
    const r = this.sqlite.prepare(this.sql).run(...this.values)
    return { success: true as const, results: [], meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
  }
}

function toValue(v: unknown): Value {
  if (v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  return v as Value
}

export const readMigration = (file: string) => readFileSync(path.join(__dirname, '..', 'migrations', file), 'utf8')

/** Base en mémoire ; `migrations` : sous-ensemble à appliquer (par défaut, toutes, dans l'ordre). */
export function createTestDb(migrations: string[] = MIGRATIONS): D1Database {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  for (const file of migrations) sqlite.exec(readMigration(file))

  const db = {
    prepare: (sql: string) => new Statement(sqlite, sql),
    batch: async (statements: Statement[]) => {
      sqlite.exec('BEGIN')
      try {
        const results = statements.map((s) => s.execute())
        sqlite.exec('COMMIT')
        return results
      } catch (e) {
        sqlite.exec('ROLLBACK')
        throw e
      }
    },
    exec: async (sql: string) => {
      sqlite.exec(sql)
      return { count: 0, duration: 0 }
    },
  }
  return db as unknown as D1Database
}
