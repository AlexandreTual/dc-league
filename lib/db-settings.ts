// Réglages du site modifiables par les admins (table site_settings, migration 0016).
import type { Result } from './db'

export async function getSetting(db: D1Database, key: string): Promise<Result<string | null>> {
  try {
    const value = await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(key).first<string>('value')
    return { data: value ?? null, error: null }
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }
}

export async function setSetting(db: D1Database, key: string, value: string, now: Date): Promise<Result<true>> {
  try {
    await db
      .prepare(
        `INSERT INTO site_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT (key) DO UPDATE SET value = ?2, updated_at = ?3`,
      )
      .bind(key, value, now.toISOString())
      .run()
    return { data: true, error: null }
  } catch (e) {
    return { data: null, error: (e as Error).message }
  }
}
