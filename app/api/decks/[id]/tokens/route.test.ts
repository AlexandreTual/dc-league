import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestDb } from '@/test/d1'
import { listDeckTokens, replaceDeckTokens } from '@/lib/db-cards'
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

const { POST } = await import('./route')

const user = (playerId: string): CurrentUser => ({ id: `u-${playerId}`, playerId, username: playerId, isAdmin: false, playerName: playerId, avatarUrl: null, isBootstrap: false })

function post(origin = 'http://site.test') {
  return POST(new Request('http://site.test/api/decks/d1/tokens', { method: 'POST', headers: { origin } }) as never, { params: Promise.resolve({ id: 'd1' }) })
}

beforeEach(async () => {
  ctx.db = createTestDb()
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex'), ('p2', 'Bob')"),
    ctx.db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d1', 'p1', 'Plantes')"),
  ])
  await replaceDeckTokens(ctx.db, 'd1', [{ id: 't', name: 'Plante', typeLine: 'Token Creature — Plant', power: '0', toughness: '1', colors: ['G'], image: null, sources: [] }])
})

describe('POST /api/decks/[id]/tokens', () => {
  it('refuse un autre joueur que le propriétaire, sans toucher aux jetons', async () => {
    ctx.user = user('p2')
    const res = await post()
    expect(res.status).toBe(403)
    expect((await listDeckTokens(ctx.db, 'd1')).data).toHaveLength(1)
  })

  it('refuse une requête venant d’un autre site', async () => {
    ctx.user = user('p1')
    expect((await post('https://ailleurs.test')).status).toBe(403)
  })

  it('refuse un visiteur non connecté', async () => {
    ctx.user = null
    expect((await post()).status).toBe(401)
  })
})
