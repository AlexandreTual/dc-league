import { describe, it, expect } from 'vitest'
import { createTestDb } from '@/test/d1'
import { aiAvailable, askDeps } from './server'
import { setAiSwitch } from './switch'

const now = new Date('2026-10-14T12:00:00Z')
const env = (db: D1Database, key?: string) => ({ DB: db, GEMINI_API_KEY: key }) as unknown as CloudflareEnv

describe("disponibilité de l'assistant IA", () => {
  it('demande la clé et l’interrupteur activé', async () => {
    const db = createTestDb()
    expect(await aiAvailable(env(db))).toBe(false)
    expect(await aiAvailable(env(db, 'cle'))).toBe(true)
    expect((await askDeps(env(db, 'cle'), now)).gemini).not.toBeNull()
    await setAiSwitch(db, false, now)
    expect(await aiAvailable(env(db, 'cle'))).toBe(false)
    expect((await askDeps(env(db, 'cle'), now)).gemini).toBeNull()
  })
})
