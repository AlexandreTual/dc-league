// Adaptateur minimal imitant l'API D1 au-dessus de node:sqlite, pour les tests.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')

type Sqlite = InstanceType<typeof DatabaseSync>
type Value = string | number | bigint | null | Uint8Array

const MIGRATIONS = ['0001_schema.sql', '0002_accounts.sql']

class Statement {
  constructor(
    private readonly sqlite: Sqlite,
    readonly sql: string,
    readonly values: Value[] = [],
  ) {}

  bind(...values: unknown[]): Statement {
    return new Statement(this.sqlite, this.sql, values.map(toValue))
  }

  async first<T>(column?: string): Promise<T | null> {
    const row = this.sqlite.prepare(this.sql).get(...this.values) as Record<string, unknown> | undefined
    if (!row) return null
    return (column ? row[column] : row) as T
  }

  async all<T>(): Promise<{ results: T[]; success: true }> {
    const rows = this.sqlite.prepare(this.sql).all(...this.values) as T[]
    return { results: rows, success: true }
  }

  async run(): Promise<{ success: true; meta: { changes: number; last_row_id: number } }> {
    return this.execute()
  }

  execute() {
    const r = this.sqlite.prepare(this.sql).run(...this.values)
    return { success: true as const, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
  }
}

function toValue(v: unknown): Value {
  if (v === undefined) return null
  if (typeof v === 'boolean') return v ? 1 : 0
  return v as Value
}

export function createTestDb(): D1Database {
  const sqlite = new DatabaseSync(':memory:')
  sqlite.exec('PRAGMA foreign_keys = ON')
  for (const file of MIGRATIONS) {
    sqlite.exec(readFileSync(path.join(__dirname, '..', 'migrations', file), 'utf8'))
  }

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
