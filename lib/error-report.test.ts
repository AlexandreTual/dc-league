import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { listErrors } from './db-errors'
import { MAX_REPORTS_PER_IP, saveClientError } from './error-report'

const now = new Date('2026-11-10T12:00:00Z')
const entry = { source: 'navigateur' as const, message: 'boom', path: '/salon' }
let db: D1Database
beforeEach(() => {
  db = createTestDb()
})

const logged = async () => (await listErrors(db, 500)).data!.length
const counted = async () => Number((await db.prepare('SELECT COUNT(*) AS n FROM login_attempts').first<{ n: number }>())!.n)

describe('saveClientError', () => {
  it('enregistre l’erreur sous la limite', async () => {
    expect(await saveClientError(db, entry, '1.2.3.4', now)).toEqual({ data: true, error: null })
    expect(await logged()).toBe(1)
  })

  it('au-delà de la limite pour une adresse : plus rien n’est écrit, ni erreur ni compteur', async () => {
    for (let i = 0; i < MAX_REPORTS_PER_IP; i++) await saveClientError(db, entry, '1.2.3.4', now)
    expect(await logged()).toBe(MAX_REPORTS_PER_IP)
    const before = await counted()
    expect(await saveClientError(db, entry, '1.2.3.4', now)).toEqual({ data: false, error: null })
    expect(await logged()).toBe(MAX_REPORTS_PER_IP)
    expect(await counted()).toBe(before)
  })

  it('la limite est par adresse et se lève après 15 minutes', async () => {
    for (let i = 0; i <= MAX_REPORTS_PER_IP; i++) await saveClientError(db, entry, '1.2.3.4', now)
    expect((await saveClientError(db, entry, '5.6.7.8', now)).data).toBe(true)
    const later = new Date(now.getTime() + 16 * 60_000)
    expect((await saveClientError(db, entry, '1.2.3.4', later)).data).toBe(true)
  })

  it('sans adresse (en local) : pas de limite', async () => {
    for (let i = 0; i < MAX_REPORTS_PER_IP + 5; i++) await saveClientError(db, entry, null, now)
    expect(await logged()).toBe(MAX_REPORTS_PER_IP + 5)
    expect(await counted()).toBe(0)
  })

  it('ne touche pas au compteur de connexion de la même adresse', async () => {
    await saveClientError(db, entry, '1.2.3.4', now)
    const row = await db.prepare('SELECT username FROM login_attempts').first<{ username: string }>()
    expect(row!.username).toBe('errors-ip:1.2.3.4')
  })
})
