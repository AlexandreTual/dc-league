import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { isAiSwitchedOn, setAiSwitch } from './switch'

const now = new Date('2026-10-14T12:00:00Z')
let db: D1Database
beforeEach(() => {
  db = createTestDb()
})

describe("interrupteur de l'assistant IA", () => {
  it('est activé par défaut', async () => {
    expect(await isAiSwitchedOn(db)).toBe(true)
  })

  it('se coupe et se rallume', async () => {
    await setAiSwitch(db, false, now)
    expect(await isAiSwitchedOn(db)).toBe(false)
    await setAiSwitch(db, true, now)
    expect(await isAiSwitchedOn(db)).toBe(true)
  })

  it('reste activé si la table n’existe pas encore (juste après un déploiement)', async () => {
    expect(await isAiSwitchedOn(createTestDb(['0001_schema.sql']))).toBe(true)
  })
})
