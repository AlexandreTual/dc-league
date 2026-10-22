import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestDb } from '@/test/d1'
import { cardRow, seedCache } from '@/test/factories'
import { listDeckCards, replaceDeckCards } from '@/lib/db-cards'
import { getDeck } from '@/lib/db-decks'
import type { CurrentUser } from '@/lib/auth/types'

const ctx = vi.hoisted(() => ({ db: null as unknown as D1Database, user: null as CurrentUser | null }))

vi.mock('@cloudflare/next-on-pages', () => ({ getRequestContext: () => ({ env: { DB: ctx.db } }) }))
vi.mock('@/lib/auth/session', async () => {
  const { NextResponse } = await import('next/server')
  const { assertSameOrigin } = await import('@/lib/auth/origin')
  return {
    assertSameOrigin,
    requireUser: async () => ctx.user ?? NextResponse.json({ error: 'Connexion requise' }, { status: 401 }),
  }
})

const { PATCH } = await import('./route')

const user = (playerId: string): CurrentUser => ({ id: `u-${playerId}`, playerId, username: playerId, isAdmin: false, playerName: playerId, avatarUrl: null, isBootstrap: false })

const sol = cardRow()
const kenrith = cardRow({ id: 'kenrith', oracle_id: 'o-ken', name: 'Kenrith, the Returned King', type_line: 'Legendary Creature — Human Noble', image_normal: 'n/kenrith.jpg' })
const atraxa = cardRow({ id: 'atraxa', oracle_id: 'o-atr', name: 'Atraxa, Praetors’ Voice', type_line: 'Legendary Creature — Phyrexian Angel Horror', image_normal: 'n/atraxa.jpg' })

const row = (position: number, name: string, en: string, section: 'main' | 'commander' = 'main') => ({
  position, quantity: 1, section, requested_name: name, requested_set: null, requested_number: null, en_card_id: en, fr_card_id: null,
})

function patch(body: unknown) {
  return PATCH(
    new Request('http://site.test/api/decks/d1/commander', { method: 'PATCH', headers: { origin: 'http://site.test' }, body: JSON.stringify(body) }) as never,
    { params: Promise.resolve({ id: 'd1' }) },
  )
}

const sectionOf = async (position: number) => (await listDeckCards(ctx.db, 'd1')).data!.find((c) => c.position === position)?.section
const image = async () => (await getDeck(ctx.db, 'd1')).data?.commander_image_url

beforeEach(async () => {
  ctx.db = createTestDb()
  ctx.user = user('p1')
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex'), ('p2', 'Bob')"),
    ctx.db.prepare("INSERT INTO decks (id, player_id, name, commander_image_url) VALUES ('d1', 'p1', 'Atraxa', 'n/atraxa.jpg')"),
  ])
  await seedCache(ctx.db, [
    { key: 'sol ring||', en: sol },
    { key: 'kenrith, the returned king||', en: kenrith },
    { key: 'atraxa||', en: atraxa },
  ])
  await replaceDeckCards(ctx.db, 'd1', [row(1, 'Atraxa', 'atraxa', 'commander'), row(2, 'Sol Ring', sol.id), row(3, 'Kenrith', 'kenrith')])
})

describe('PATCH /api/decks/[id]/commander', () => {
  it('aller puis retour : la carte revient dans le deck et l’image du deck est recalculée', async () => {
    expect((await patch({ position: 3 })).status).toBe(200)
    expect(await sectionOf(3)).toBe('commander')
    expect(await image()).toBe('n/kenrith.jpg')

    expect((await patch({ position: 3, commander: false })).status).toBe(200)
    expect(await sectionOf(3)).toBe('main')
    expect(await sectionOf(1)).toBe('commander')
    expect(await image()).toBe('n/atraxa.jpg')
  })

  it('retirer le dernier commandant efface l’image du deck', async () => {
    expect((await patch({ position: 1, commander: false })).status).toBe(200)
    expect(await sectionOf(1)).toBe('main')
    expect(await image()).toBeNull()
  })

  it('refuse une position inconnue ou un champ commander invalide', async () => {
    expect((await patch({ position: 99, commander: false })).status).toBe(404)
    expect((await patch({ position: 1, commander: 'non' })).status).toBe(400)
    expect(await sectionOf(1)).toBe('commander')
  })

  it('refuse un autre joueur que le propriétaire', async () => {
    ctx.user = user('p2')
    expect((await patch({ position: 1, commander: false })).status).toBe(403)
    expect(await sectionOf(1)).toBe('commander')
  })
})
