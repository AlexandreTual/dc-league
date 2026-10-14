import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { getSetting, setSetting } from './db-settings'

const now = new Date('2026-10-14T12:00:00Z')
let db: D1Database
beforeEach(() => {
  db = createTestDb()
})

describe('réglages du site', () => {
  it('renvoie null pour un réglage absent', async () => {
    expect(await getSetting(db, 'x')).toEqual({ data: null, error: null })
  })

  it('écrit, relit et réécrit un réglage', async () => {
    await setSetting(db, 'x', '1', now)
    expect((await getSetting(db, 'x')).data).toBe('1')
    await setSetting(db, 'x', '0', now)
    expect((await getSetting(db, 'x')).data).toBe('0')
  })

  it("renvoie une erreur si la table n'existe pas encore", async () => {
    const old = createTestDb(['0001_schema.sql'])
    expect((await getSetting(old, 'x')).error).not.toBeNull()
    expect((await setSetting(old, 'x', '1', now)).error).not.toBeNull()
  })
})
