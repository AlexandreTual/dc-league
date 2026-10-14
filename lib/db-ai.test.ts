import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { getAiUsage, giveBackAiQuestion, takeAiQuestion } from './db-ai'

const DAY = '2026-10-13'
let db: D1Database
beforeEach(() => {
  db = createTestDb()
})

describe('compteur de questions IA', () => {
  it('vaut 0 pour un compte sans question', async () => {
    expect(await getAiUsage(db, 'u1', DAY)).toEqual({ data: 0, error: null })
  })

  it('compte les questions et refuse la 21e sans changer le compteur', async () => {
    expect((await takeAiQuestion(db, 'u1', DAY, 20)).data).toBe(19)
    for (let i = 2; i <= 19; i++) await takeAiQuestion(db, 'u1', DAY, 20)
    expect((await takeAiQuestion(db, 'u1', DAY, 20)).data).toBe(0)
    expect(await takeAiQuestion(db, 'u1', DAY, 20)).toEqual({ data: null, error: null })
    expect((await getAiUsage(db, 'u1', DAY)).data).toBe(20)
  })

  it('repart à zéro le jour suivant et sépare les comptes', async () => {
    for (let i = 0; i < 20; i++) await takeAiQuestion(db, 'u1', DAY, 20)
    expect((await takeAiQuestion(db, 'u1', '2026-10-14', 20)).data).toBe(19)
    expect((await takeAiQuestion(db, 'u2', DAY, 20)).data).toBe(19)
  })

  it('rend une question, sans descendre sous 0', async () => {
    await takeAiQuestion(db, 'u1', DAY, 20)
    await takeAiQuestion(db, 'u1', DAY, 20)
    await giveBackAiQuestion(db, 'u1', DAY)
    expect((await getAiUsage(db, 'u1', DAY)).data).toBe(1)
    await giveBackAiQuestion(db, 'u1', DAY)
    await giveBackAiQuestion(db, 'u1', DAY)
    expect((await getAiUsage(db, 'u1', DAY)).data).toBe(0)
    expect((await giveBackAiQuestion(db, 'u9', DAY)).error).toBeNull()
  })

  it("renvoie une erreur si la table n'existe pas encore", async () => {
    const old = createTestDb(['0001_schema.sql'])
    expect((await takeAiQuestion(old, 'u1', DAY, 20)).error).not.toBeNull()
    expect((await getAiUsage(old, 'u1', DAY)).error).not.toBeNull()
  })
})

describe('utilisation du jour', () => {
  it('compte les questions et les joueurs du jour seulement', async () => {
    const { getAiUsageOfDay } = await import('./db-ai')
    expect((await getAiUsageOfDay(db, DAY)).data).toEqual({ questions: 0, players: 0 })
    await takeAiQuestion(db, 'u1', DAY, 20)
    await takeAiQuestion(db, 'u1', DAY, 20)
    await takeAiQuestion(db, 'u2', DAY, 20)
    await takeAiQuestion(db, 'u3', '2026-10-12', 20)
    expect((await getAiUsageOfDay(db, DAY)).data).toEqual({ questions: 3, players: 2 })
  })
})
