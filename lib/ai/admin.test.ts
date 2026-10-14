import { describe, it, expect } from 'vitest'
import { createTestDb } from '@/test/d1'
import { takeAiQuestion } from '@/lib/db-ai'
import { aiAdminStatus } from './admin'
import { parisDay } from './quota'
import { setAiSwitch } from './switch'

const now = new Date('2026-10-14T12:00:00Z')

describe('état admin de l’assistant IA', () => {
  it('donne l’interrupteur, la clé et l’utilisation du jour', async () => {
    const db = createTestDb()
    const env = (key?: string) => ({ DB: db, GEMINI_API_KEY: key }) as unknown as CloudflareEnv
    expect(await aiAdminStatus(env(), now)).toEqual({ enabled: true, keyPresent: false, today: { questions: 0, players: 0 } })
    await takeAiQuestion(db, 'u1', parisDay(now), 20)
    await setAiSwitch(db, false, now)
    expect(await aiAdminStatus(env('cle'), now)).toEqual({ enabled: false, keyPresent: true, today: { questions: 1, players: 1 } })
  })

  it('tolère une base pas encore migrée', async () => {
    const env = { DB: createTestDb(['0001_schema.sql']) } as unknown as CloudflareEnv
    expect(await aiAdminStatus(env, now)).toEqual({ enabled: true, keyPresent: false, today: { questions: 0, players: 0 } })
  })
})
