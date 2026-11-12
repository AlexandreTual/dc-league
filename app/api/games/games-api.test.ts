// Routes du salon et de la WebSocket : droits, origine, et ce que le site transmet au serveur de jeu.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createTestDb } from '@/test/d1'
import type { CurrentUser } from '@/lib/auth/types'
import { createTable, finishTable, getTable, joinTable, markPlaying } from '@/lib/db-games'

/** Faux Durable Object : note chaque requête reçue (adresse, méthode, en-têtes). */
type Received = { url: string; method: string; headers: Headers }
const ctx = vi.hoisted(() => ({
  db: null as unknown as D1Database,
  user: null as CurrentUser | null,
  received: [] as Received[],
  stubStatus: 200,
}))

vi.mock('@cloudflare/next-on-pages', () => ({
  getRequestContext: () => ({
    env: {
      DB: ctx.db,
      GAME: {
        idFromName: (name: string) => `id:${name}`,
        get: (id: string) => ({
          fetch: async (url: string, init: RequestInit = {}) => {
            ctx.received.push({ url, method: init.method ?? 'GET', headers: new Headers(init.headers) })
            return new Response(null, { status: ctx.stubStatus, headers: { 'x-stub': id } })
          },
        }),
      },
    },
  }),
}))
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T,>(fn: T) => fn }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'jeton' }) }) }))
vi.mock('@/lib/auth/resolve', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/resolve')>()),
  resolveSession: async () => ctx.user,
}))

const lobby = await import('./route')
const table = await import('./[id]/route')
const join = await import('./[id]/join/route')
const leave = await import('./[id]/leave/route')
const kick = await import('./[id]/kick/route')
const deck = await import('./[id]/deck/route')
const start = await import('./[id]/start/route')
const rematch = await import('./[id]/rematch/route')
const tokens = await import('./[id]/tokens/route')
const ws = await import('./[id]/ws/route')

const SITE = 'http://site.test'
const user = (playerId: string, extra: Partial<CurrentUser> = {}): CurrentUser => ({
  id: `u-${playerId}`, playerId, username: playerId, isAdmin: false, playerName: playerId, avatarUrl: null, isBootstrap: false, ...extra,
})
const HOST = user('p1')
const GUEST = user('p2')
const OUTSIDER = user('p3')
const BOOTSTRAP = user('boot', { isBootstrap: true, id: 'bootstrap' })

function req(method: string, path: string, { body, origin = SITE, headers = {} }: { body?: string; origin?: string | null; headers?: Record<string, string> } = {}) {
  const h = new Headers({ 'content-type': 'application/json', ...headers })
  if (origin) h.set('origin', origin)
  return new NextRequest(`${SITE}${path}`, { method, headers: h, body })
}
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const as = (u: CurrentUser | null) => { ctx.user = u }
const status = async (u: CurrentUser | null, call: () => Promise<Response>) => { as(u); return (await call()).status }

let tableId: string

beforeEach(async () => {
  ctx.db = createTestDb()
  ctx.user = null
  ctx.received = []
  ctx.stubStatus = 200
  await ctx.db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex'), ('p2', 'Bob'), ('p3', 'Chloé'), ('boot', 'Démarrage')").run()
  tableId = (await createTable(ctx.db, { hostPlayerId: 'p1', format: 'commander', seats: 3, eliminatedSeeAll: false })).data!.id
  await joinTable(ctx.db, tableId, 'p2')
})

const playing = () => markPlaying(ctx.db, tableId)

/** Routes d'écriture du salon (gameWrite) et de lecture (requirePlayer). */
const WRITES: { name: string; call: (origin?: string | null, body?: string) => Promise<Response> }[] = [
  { name: 'POST games', call: (o, b = '{"format":"duel"}') => lobby.POST(req('POST', '/api/games', { origin: o, body: b })) },
  { name: 'POST join', call: (o, b) => join.POST(req('POST', `/api/games/${tableId}/join`, { origin: o, body: b }), params(tableId)) },
  { name: 'POST leave', call: (o, b) => leave.POST(req('POST', `/api/games/${tableId}/leave`, { origin: o, body: b }), params(tableId)) },
  { name: 'POST kick', call: (o, b = '{"playerId":"p2"}') => kick.POST(req('POST', `/api/games/${tableId}/kick`, { origin: o, body: b }), params(tableId)) },
  { name: 'POST deck', call: (o, b = '{"deckId":"d"}') => deck.POST(req('POST', `/api/games/${tableId}/deck`, { origin: o, body: b }), params(tableId)) },
  { name: 'POST start', call: (o, b) => start.POST(req('POST', `/api/games/${tableId}/start`, { origin: o, body: b }), params(tableId)) },
  { name: 'POST rematch', call: (o, b) => rematch.POST(req('POST', `/api/games/${tableId}/rematch`, { origin: o, body: b }), params(tableId)) },
]
const READS: { name: string; call: () => Promise<Response> }[] = [
  { name: 'GET games', call: () => lobby.GET() },
  { name: 'GET games/[id]', call: () => table.GET(req('GET', `/api/games/${tableId}`), params(tableId)) },
  { name: 'GET tokens', call: () => tokens.GET(req('GET', `/api/games/${tableId}/tokens`), params(tableId)) },
]

describe('salon : droits', () => {
  for (const r of WRITES) {
    it(`${r.name} : visiteur 401, session de démarrage 403, autre origine 403`, async () => {
      expect(await status(null, () => r.call())).toBe(401)
      expect(await status(BOOTSTRAP, () => r.call())).toBe(403)
      expect(await status(HOST, () => r.call('http://evil.test'))).toBe(403)
      expect(ctx.received).toEqual([])
    })
  }
  for (const r of READS) {
    it(`${r.name} : visiteur 401, session de démarrage 403`, async () => {
      expect(await status(null, r.call)).toBe(401)
      expect(await status(BOOTSTRAP, r.call)).toBe(403)
      expect(await status(HOST, r.call)).toBe(200)
    })
  }

  it('corps qui n’est pas un objet : traité comme vide', async () => {
    as(HOST)
    for (const body of ['[1,2]', 'null', '"duel"', '42', 'pas du json']) {
      const res = await lobby.POST(req('POST', '/api/games', { body }))
      expect(res.status, body).toBe(400)
      expect(await res.json()).toEqual({ error: 'Format inconnu' })
    }
  })

  it('table introuvable : 404', async () => {
    expect(await status(HOST, () => table.GET(req('GET', '/api/games/zz'), params('zz')))).toBe(404)
    expect(await status(HOST, () => join.POST(req('POST', '/api/games/zz/join'), params('zz')))).toBe(404)
  })

  it('seul l’hôte retire un joueur ou démarre', async () => {
    expect(await status(GUEST, () => kick.POST(req('POST', `/api/games/${tableId}/kick`, { body: '{"playerId":"p1"}' }), params(tableId)))).toBe(403)
    expect(await status(GUEST, () => start.POST(req('POST', `/api/games/${tableId}/start`, { body: '{}' }), params(tableId)))).toBe(403)
    expect((await getTable(ctx.db, tableId)).data!.players.map((p) => p.playerId)).toEqual(['p1', 'p2'])
    expect(ctx.received).toEqual([])
  })

  it('un joueur rejoint puis quitte', async () => {
    expect(await status(OUTSIDER, () => join.POST(req('POST', `/api/games/${tableId}/join`), params(tableId)))).toBe(200)
    expect(await status(OUTSIDER, () => leave.POST(req('POST', `/api/games/${tableId}/leave`), params(tableId)))).toBe(200)
    expect((await getTable(ctx.db, tableId)).data!.players.map((p) => p.playerId)).toEqual(['p1', 'p2'])
  })
})

describe('WebSocket', () => {
  const open = (u: CurrentUser | null, { id = tableId, origin = SITE as string | null, headers = {} as Record<string, string> } = {}) => {
    as(u)
    return ws.GET(req('GET', `/api/games/${id}/ws`, { origin, headers: { upgrade: 'websocket', 'sec-websocket-key': 'clé', 'sec-websocket-version': '13', ...headers } }), params(id))
  }

  it('sans demande de WebSocket : 426', async () => {
    as(HOST)
    await playing()
    expect((await ws.GET(req('GET', `/api/games/${tableId}/ws`), params(tableId))).status).toBe(426)
  })

  it('visiteur et session de démarrage : 401 ; autre origine : 403', async () => {
    await playing()
    expect((await open(null)).status).toBe(401)
    expect((await open(BOOTSTRAP)).status).toBe(401)
    expect((await open(HOST, { origin: 'http://evil.test' })).status).toBe(403)
    expect(ctx.received).toEqual([])
  })

  it('table ouverte, introuvable ou archivée : 404, rien n’est transmis', async () => {
    expect((await open(HOST)).status).toBe(404)
    expect((await open(HOST, { id: 'zz' })).status).toBe(404)
    await playing()
    await finishTable(ctx.db, tableId, 'p1')
    await ctx.db.prepare("UPDATE game_tables SET game_archived_at = datetime('now') WHERE id = ?").bind(tableId).run()
    expect((await open(HOST)).status).toBe(404)
    expect(ctx.received).toEqual([])
  })

  it('joueur assis : X-Player-Id posé par le site, vers le Durable Object de la table', async () => {
    await playing()
    expect((await open(GUEST)).headers.get('x-stub')).toBe(`id:${tableId}`)
    const [sent] = ctx.received
    expect(sent.url).toBe(`https://game/tables/${tableId}/ws`)
    expect(sent.headers.get('X-Player-Id')).toBe('p2')
    expect(sent.headers.get('X-Spectator')).toBeNull()
    expect(sent.headers.get('Upgrade')).toBe('websocket')
    expect(sent.headers.get('sec-websocket-key')).toBe('clé')
  })

  it('autre joueur : spectateur', async () => {
    await playing()
    await open(OUTSIDER)
    expect(ctx.received[0].headers.get('X-Spectator')).toBe('1')
    expect(ctx.received[0].headers.get('X-Player-Id')).toBeNull()
  })

  it('les en-têtes du navigateur ne passent jamais (X-Player-Id, cookie…)', async () => {
    await playing()
    await open(OUTSIDER, { headers: { 'X-Player-Id': 'p1', 'X-Spectator': '0', cookie: 'dc_session=secret', authorization: 'x' } })
    await open(GUEST, { headers: { 'X-Player-Id': 'p1' } })
    const [spectator, guest] = ctx.received.map((r) => r.headers)
    expect(spectator.get('X-Player-Id')).toBeNull()
    expect(spectator.get('X-Spectator')).toBe('1')
    expect(spectator.get('cookie')).toBeNull()
    expect(spectator.get('authorization')).toBeNull()
    expect(guest.get('X-Player-Id')).toBe('p2')
    expect([...guest.keys()].sort()).toEqual(['sec-websocket-key', 'sec-websocket-version', 'upgrade', 'x-player-id'])
  })

  it('table en cours de démarrage : 404', async () => {
    await ctx.db.prepare("UPDATE game_tables SET status = 'starting' WHERE id = ?").bind(tableId).run()
    expect((await open(HOST)).status).toBe(404)
  })
})
