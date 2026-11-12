// Couche Cloudflare du serveur de jeu : routes du Worker et du Durable Object, en-têtes lus, sockets à hibernation.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestDb } from '@/test/d1'
import { setupFor } from '@/test/game-fixtures'
import { createTable, joinTable, markPlaying } from '../../lib/db-games'

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    ctx: unknown
    env: unknown
    constructor(ctx: unknown, env: unknown) { this.ctx = ctx; this.env = env }
  },
}))

/** Socket côté serveur : pièce jointe et messages reçus. */
class FakeWs {
  attachment: unknown = null
  sent: string[] = []
  closed = false
  serializeAttachment(v: unknown) { this.attachment = structuredClone(v) }
  deserializeAttachment() { return this.attachment }
  send(data: string) { this.sent.push(data) }
  close() { this.closed = true }
}

// Node refuse un statut 101 et ne connaît pas WebSocketPair : version minimale, qui garde le statut et la socket.
class TestResponse extends Response {
  private realStatus: number
  webSocket: unknown
  constructor(body?: BodyInit | null, init: ResponseInit & { webSocket?: unknown } = {}) {
    super(body, init.status === 101 ? { ...init, status: 200 } : init)
    this.realStatus = init.status ?? 200
    this.webSocket = init.webSocket ?? null
  }
  get status() { return this.realStatus }
}
vi.stubGlobal('Response', TestResponse)
vi.stubGlobal('WebSocketPair', class { 0 = new FakeWs(); 1 = new FakeWs() })

const { GameRoom } = await import('./room-do')
const worker = (await import('./index')).default

class MemoryStorage {
  data = new Map<string, unknown>()
  async get<T>(key: string) { return structuredClone(this.data.get(key)) as T | undefined }
  async put(key: string, value: unknown) { this.data.set(key, structuredClone(value)) }
  async delete(key: string) { return this.data.delete(key) }
  async list<T>({ prefix }: { prefix: string }) {
    return new Map([...this.data].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b))) as Map<string, T>
  }
  async deleteAll() { this.data.clear() }
}

let db: D1Database
let tableId: string
let storage: MemoryStorage
let accepted: FakeWs[]

const room = () => new GameRoom({
  storage,
  getWebSockets: () => accepted,
  acceptWebSocket: (ws: FakeWs) => { accepted.push(ws) },
} as never, { DB: db } as never)

const url = (path = '') => `https://game/tables/${tableId}${path}`
const init = (r: InstanceType<typeof GameRoom>) =>
  r.fetch(new Request(url('/init'), { method: 'POST', body: JSON.stringify({ tableId, setup: setupFor('commander', 2), hostId: 'p1' }) }))
const ws = (r: InstanceType<typeof GameRoom>, headers: Record<string, string> = {}) =>
  r.fetch(new Request(url('/ws'), { headers: { Upgrade: 'websocket', ...headers } }))

beforeEach(async () => {
  db = createTestDb()
  for (const [id, name] of [['p1', 'Alex'], ['p2', 'Bob']]) await db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, name).run()
  tableId = (await createTable(db, { hostPlayerId: 'p1', format: 'commander', seats: 2, eliminatedSeeAll: false })).data!.id
  await joinTable(db, tableId, 'p2')
  await markPlaying(db, tableId)
  storage = new MemoryStorage()
  accepted = []
})

describe('Worker de jeu', () => {
  it('transmet /tables/<id>/… au Durable Object de la table, 404 sinon', async () => {
    const seen: string[] = []
    const GAME = {
      idFromName: (name: string) => `id:${name}`,
      get: (id: string) => ({ fetch: async (req: Request) => { seen.push(`${id} ${new URL(req.url).pathname}`); return new Response('ok') } }),
    }
    const env = { DB: db, GAME } as never
    expect((await worker.fetch(new Request('https://game/tables/t9/ws'), env)).status).toBe(200)
    expect(seen).toEqual(['id:t9 /tables/t9/ws'])
    expect((await worker.fetch(new Request('https://game/autre/t9'), env)).status).toBe(404)
    expect((await worker.fetch(new Request('https://game/tables/'), env)).status).toBe(404)
    expect(seen).toHaveLength(1)
  })
})

describe('Durable Object GameRoom', () => {
  it('init une seule fois ; route inconnue : 404', async () => {
    const r = room()
    expect((await init(r)).status).toBe(201)
    expect((await init(r)).status).toBe(409)
    expect((await r.fetch(new Request(url('/autre')))).status).toBe(404)
  })

  it('WebSocket : 426 sans demande, 404 sans partie', async () => {
    const r = room()
    expect((await r.fetch(new Request(url('/ws')))).status).toBe(426)
    expect((await ws(r, { 'X-Player-Id': 'p1' })).status).toBe(404)
    expect(accepted).toEqual([])
  })

  it('X-Player-Id : socket du joueur, qui reçoit sa vue', async () => {
    const r = room()
    await init(r)
    const res = await ws(r, { 'X-Player-Id': 'p2' })
    expect(res.status).toBe(101)
    expect(accepted).toHaveLength(1)
    expect(accepted[0].attachment).toEqual({ playerId: 'p2' })
    expect(JSON.parse(accepted[0].sent.at(-1)!)).toMatchObject({ type: 'view', view: { me: 'p2' } })
  })

  it('X-Spectator (ou rien) : socket de spectateur', async () => {
    const r = room()
    await init(r)
    await ws(r, { 'X-Spectator': '1' })
    await ws(r)
    expect(accepted.map((s) => s.attachment)).toEqual([{ playerId: null }, { playerId: null }])
  })

  it('identifiant hostile dans X-Player-Id : ni exception ni partie bloquée', async () => {
    const r = room()
    await init(r)
    for (const bad of ['toString', '__proto__', 'constructor']) {
      expect((await ws(r, { 'X-Player-Id': bad })).status).toBe(101)
      await r.webSocketMessage(accepted.at(-1) as never, JSON.stringify({ type: 'action', action: { type: 'keep' } }))
      await r.webSocketClose(accepted.at(-1) as never)
    }
    await ws(r, { 'X-Player-Id': 'p1' })
    const socket = accepted.at(-1)!
    await r.webSocketMessage(socket as never, JSON.stringify({ type: 'action', action: { type: 'keep' } }))
    expect([...storage.data.keys()]).toContain('a:000001')
  })

  it('messages binaires ignorés, texte transmis', async () => {
    const r = room()
    await init(r)
    await ws(r, { 'X-Player-Id': 'p1' })
    const socket = accepted[0]
    const before = socket.sent.length
    await r.webSocketMessage(socket as never, new TextEncoder().encode(JSON.stringify({ type: 'action', action: { type: 'keep' } })).buffer as ArrayBuffer)
    expect(socket.sent.length).toBe(before)
    await r.webSocketMessage(socket as never, JSON.stringify({ type: 'action', action: { type: 'keep' } }))
    expect(socket.sent.length).toBe(before + 1)
    expect([...storage.data.keys()]).toContain('a:000001')
  })

  it('DELETE : 204, stockage vidé, sockets fermées', async () => {
    const r = room()
    await init(r)
    await ws(r, { 'X-Player-Id': 'p1' })
    expect((await r.fetch(new Request(url(), { method: 'DELETE' }))).status).toBe(204)
    expect(storage.data.size).toBe(0)
    expect(accepted[0].closed).toBe(true)
    expect((await ws(r, { 'X-Player-Id': 'p1' })).status).toBe(404)
  })

  it('fermeture et erreur de socket : le joueur passe absent sans exception', async () => {
    const r = room()
    await init(r)
    await ws(r, { 'X-Player-Id': 'p1' })
    await ws(r, { 'X-Player-Id': 'p2' })
    const [s1, s2] = accepted
    accepted = [s2]
    await r.webSocketClose(s1 as never)
    expect(JSON.parse(s2.sent.at(-1)!)).toMatchObject({ type: 'view', online: ['p2'] })
    await expect(r.webSocketError(s1 as never)).resolves.toBeUndefined()
  })
})
