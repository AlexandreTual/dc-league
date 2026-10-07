import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDb } from '@/test/d1'
import { setupFor } from '@/test/game-fixtures'
import { createTable, getTable, joinTable, markPlaying } from '../../lib/db-games'
import { replay } from '../../lib/game/replay'
import type { ServerMessage } from '../../lib/game/room'
import { RoomRuntime, type KvStorage, type Socket, type SocketInfo } from './runtime'
import { cleanupStale } from './cleanup'

/** Stockage en mémoire qui note l'ordre des écritures et peut échouer à la demande. */
class MemoryStorage implements KvStorage {
  data = new Map<string, unknown>()
  journal: string[]
  failNextPut = false
  constructor(journal: string[]) { this.journal = journal }
  async get<T>(key: string): Promise<T | undefined> { return structuredClone(this.data.get(key)) as T | undefined }
  async put(key: string, value: unknown) {
    if (this.failNextPut) { this.failNextPut = false; throw new Error('stockage indisponible') }
    this.journal.push(`put ${key}`)
    this.data.set(key, structuredClone(value))
  }
  async delete(key: string) { this.journal.push(`delete ${key}`); return this.data.delete(key) }
  async list<T>({ prefix }: { prefix: string }) {
    return new Map([...this.data].filter(([k]) => k.startsWith(prefix)).sort(([a], [b]) => a.localeCompare(b))) as Map<string, T>
  }
  async deleteAll() { this.data.clear() }
}

class FakeSocket implements Socket {
  received: ServerMessage[] = []
  closed = false
  constructor(private journal: string[], private name: string) {}
  send(data: string) { this.journal.push(`send ${this.name}`); this.received.push(JSON.parse(data)) }
  close() { this.closed = true }
  last() { return this.received.at(-1)! }
}

let db: D1Database
let journal: string[]
let storage: MemoryStorage
let now: number
let sockets: { socket: FakeSocket; info: SocketInfo }[]
let tableId: string

const runtime = () => new RoomRuntime(storage, db, () => sockets, () => now, () => 42)
const setup = setupFor('commander', 2)

async function open(rt: RoomRuntime, playerId: string | null, name = playerId ?? 'spect') {
  const socket = new FakeSocket(journal, name)
  await rt.load()
  sockets.push({ socket, info: { playerId } })
  await rt.connect(socket, { playerId })
  return socket
}

const send = (rt: RoomRuntime, socket: FakeSocket, msg: unknown) =>
  rt.message(socket, sockets.find((s) => s.socket === socket)!.info, typeof msg === 'string' ? msg : JSON.stringify(msg))

beforeEach(async () => {
  db = createTestDb()
  for (const [id, name] of [['p1', 'Alex'], ['p2', 'Bob']]) await db.prepare('INSERT INTO players (id, name) VALUES (?, ?)').bind(id, name).run()
  tableId = (await createTable(db, { hostPlayerId: 'p1', format: 'commander', seats: 2, eliminatedSeeAll: false })).data!.id
  await joinTable(db, tableId, 'p2')
  await markPlaying(db, tableId)
  journal = []
  storage = new MemoryStorage(journal)
  now = Date.parse('2026-10-04T20:00:00Z')
  sockets = []
})

describe('init et connexion', () => {
  it('initialise une seule fois et envoie la vue à la connexion', async () => {
    const rt = runtime()
    expect((await rt.init({ tableId, setup, hostId: 'p1' })).status).toBe(201)
    expect((await rt.init({ tableId, setup, hostId: 'p1' })).status).toBe(409)
    const s1 = await open(rt, 'p1')
    expect(s1.last()).toMatchObject({ type: 'view', host: 'p1', online: ['p1'] })
  })

  it('premier joueur choisi par l’hôte', async () => {
    const rt = runtime()
    await rt.init({ tableId, setup, hostId: 'p1', firstPlayer: 'p2' })
    const s1 = await open(rt, 'p1')
    expect(s1.last()).toMatchObject({ type: 'view', view: { activePlayer: 'p2', firstChosen: true } })
  })
})

describe('actions et persistance', () => {
  it('écrit l’action avant de diffuser les vues ; annuler efface la clé', async () => {
    const rt = runtime()
    await rt.init({ tableId, setup, hostId: 'p1' })
    const s1 = await open(rt, 'p1')
    const s2 = await open(rt, 'p2')
    journal.length = 0
    await send(rt, s1, { type: 'action', action: { type: 'draw', count: 1 } })
    expect(journal).toEqual(['put a:000001', 'send p1', 'send p2'])
    expect(storage.data.get('a:000001')).toEqual({ type: 'draw', actor: 'p1', count: 1 })
    await send(rt, s1, { type: 'undo' })
    expect(storage.data.has('a:000001')).toBe(false)
    expect(s2.last()).toMatchObject({ type: 'view' })
  })

  it('refus du moteur : seul l’auteur est prévenu', async () => {
    const rt = runtime()
    await rt.init({ tableId, setup, hostId: 'p1' })
    const s1 = await open(rt, 'p1')
    const s2 = await open(rt, 'p2')
    const before = s2.received.length
    await send(rt, s1, { type: 'undo' })
    expect(s1.last()).toEqual({ type: 'rejected', error: 'Rien à annuler' })
    expect(s2.received).toHaveLength(before)
  })

  it('échec d’écriture : action retirée, « Réessaie », aucune diffusion', async () => {
    const rt = runtime()
    await rt.init({ tableId, setup, hostId: 'p1' })
    const s1 = await open(rt, 'p1')
    const s2 = await open(rt, 'p2')
    const handBefore = (s1.last() as Extract<ServerMessage, { type: 'view' }>).view.players.p1.zones.hand.length
    const before = s2.received.length
    storage.failNextPut = true
    await send(rt, s1, { type: 'action', action: { type: 'draw', count: 1 } })
    expect(s1.last()).toEqual({ type: 'rejected', error: 'Réessaie' })
    expect(s2.received).toHaveLength(before)
    await send(rt, s1, { type: 'action', action: { type: 'draw', count: 1 } })
    const view = (s1.last() as Extract<ServerMessage, { type: 'view' }>).view
    expect(view.players.p1.zones.hand).toHaveLength(handBefore + 1)
    expect(storage.data.has('a:000001')).toBe(true)
    expect(storage.data.has('a:000002')).toBe(false)
  })

  it('ignore les messages trop gros, illisibles ou trop rapides', async () => {
    const rt = runtime()
    await rt.init({ tableId, setup, hostId: 'p1' })
    const s1 = await open(rt, 'p1')
    const count = () => s1.received.length
    let before = count()
    await send(rt, s1, JSON.stringify({ type: 'action', action: { type: 'draw', count: 1 }, pad: 'x'.repeat(16 * 1024) }))
    await send(rt, s1, '{pas du json')
    await send(rt, s1, '42')
    expect(count()).toBe(before)
    now += 1001
    before = count()
    for (let i = 0; i < 25; i++) await send(rt, s1, { type: 'action', action: { type: 'shuffle' } })
    expect(count() - before).toBe(20)
    now += 1001
    await send(rt, s1, { type: 'action', action: { type: 'shuffle' } })
    expect(count() - before).toBe(21)
  })
})

describe('réveil', () => {
  it('recharge le même état et renvoie toutes les cartes visibles', async () => {
    const rt = runtime()
    await rt.init({ tableId, setup, hostId: 'p1' })
    const s1 = await open(rt, 'p1')
    await send(rt, s1, { type: 'action', action: { type: 'keep' } })
    await send(rt, s1, { type: 'action', action: { type: 'draw', count: 2 } })
    expect((s1.last() as Extract<ServerMessage, { type: 'view' }>).cards).toEqual({})

    const awake = runtime()
    await awake.load()
    expect(awake.state()!.history.state).toEqual(rt.state()!.history.state)
    expect(awake.state()!.history.state).toEqual(replay(setup, rt.state()!.history.actions))
    expect(awake.state()!.online).toEqual({ p1: 1 })
    await send(awake, s1, { type: 'action', action: { type: 'draw', count: 1 } })
    const cards = (s1.last() as Extract<ServerMessage, { type: 'view' }>).cards
    expect(Object.keys(cards.p1).length).toBeGreaterThan(1)
  })
})

describe('D1', () => {
  it('activité au plus une fois par minute, vainqueur et hôte', async () => {
    const rt = runtime()
    await rt.init({ tableId, setup, hostId: 'p1' })
    const s1 = await open(rt, 'p1')
    const s2 = await open(rt, 'p2')
    const activity = async () => (await getTable(db, tableId)).data!.lastActivityAt
    await send(rt, s1, { type: 'action', action: { type: 'draw', count: 1 } })
    expect(await activity()).toBe('2026-10-04 20:00:00')
    now += 30_000
    await send(rt, s1, { type: 'action', action: { type: 'draw', count: 1 } })
    expect(await activity()).toBe('2026-10-04 20:00:00')
    now += 31_000
    await send(rt, s1, { type: 'action', action: { type: 'draw', count: 1 } })
    expect(await activity()).toBe('2026-10-04 20:01:01')

    sockets = sockets.filter((s) => s.socket !== s1)
    await rt.disconnect(s1, { playerId: 'p1' })
    now += 5 * 60_000 + 1
    await send(rt, s2, { type: 'action', action: { type: 'draw', count: 1 } })
    expect((await getTable(db, tableId)).data!.hostPlayerId).toBe('p2')
    expect(storage.data.get('meta')).toMatchObject({ hostId: 'p2' })

    await send(rt, s2, { type: 'host', op: 'eliminate', target: 'p1' })
    expect((await getTable(db, tableId)).data).toMatchObject({ status: 'finished', winnerPlayerId: 'p2' })
    expect(storage.data.get('meta')).toMatchObject({ finished: true, winner: 'p2' })
  })

  it('fin de partie non enregistrée en D1 : retentée à la connexion suivante ou par sync', async () => {
    const real = db
    let failFinish = true
    const flaky = {
      ...real,
      prepare: (sql: string) => {
        if (failFinish && sql.includes("status = 'finished'")) throw new Error('D1 indisponible')
        return real.prepare(sql)
      },
    } as D1Database
    const rt = new RoomRuntime(storage, flaky, () => sockets, () => now, () => 42)
    await rt.init({ tableId, setup, hostId: 'p1' })
    const s1 = await open(rt, 'p1')
    await open(rt, 'p2')
    await send(rt, s1, { type: 'host', op: 'eliminate', target: 'p2' })
    expect((await getTable(real, tableId)).data!.status).toBe('playing')
    expect(storage.data.get('meta')).toMatchObject({ finished: true, finishPending: true })

    // Réveil : toujours en échec, puis D1 revient.
    const awake = new RoomRuntime(storage, flaky, () => sockets, () => now, () => 42)
    await awake.sync()
    expect(storage.data.get('meta')).toMatchObject({ finishPending: true })
    failFinish = false
    await awake.sync()
    expect((await getTable(real, tableId)).data).toMatchObject({ status: 'finished', winnerPlayerId: 'p1' })
    expect(storage.data.get('meta')).toMatchObject({ finishPending: false })
  })
})

describe('présence à travers l’hibernation', () => {
  it('la date d’absence de l’hôte est enregistrée : son rôle passe même si l’objet a dormi', async () => {
    const rt = runtime()
    await rt.init({ tableId, setup, hostId: 'p1' })
    const s1 = await open(rt, 'p1')
    const s2 = await open(rt, 'p2')
    sockets = sockets.filter((s) => s.socket !== s1)
    await rt.disconnect(s1, { playerId: 'p1' })
    expect(storage.data.get('presence')).toEqual({ p1: now })

    // L'objet dort 6 minutes puis se réveille sur un message de p2.
    now += 6 * 60_000
    const awake = runtime()
    await send(awake, s2, { type: 'action', action: { type: 'draw', count: 1 } })
    expect(awake.state()!.hostId).toBe('p2')
    expect((await getTable(db, tableId)).data!.hostPlayerId).toBe('p2')
  })

  it('reconnexion : la présence enregistrée est effacée', async () => {
    const rt = runtime()
    await rt.init({ tableId, setup, hostId: 'p1' })
    expect(storage.data.get('presence')).toEqual({ p1: now, p2: now })
    await open(rt, 'p1')
    expect(storage.data.get('presence')).toEqual({ p2: now })
  })
})

describe('destroy et nettoyage', () => {
  it('destroy vide le stockage et ferme les sockets', async () => {
    const rt = runtime()
    await rt.init({ tableId, setup, hostId: 'p1' })
    const s1 = await open(rt, 'p1')
    await rt.destroy()
    expect(storage.data.size).toBe(0)
    expect(s1.closed).toBe(true)
  })

  it('cleanupStale supprime les tables inactives et leur partie', async () => {
    await db.prepare("UPDATE game_tables SET last_activity_at = '2026-09-01 00:00:00' WHERE id = ?").bind(tableId).run()
    const fresh = (await createTable(db, { hostPlayerId: 'p1', format: 'duel', seats: 2, eliminatedSeeAll: false })).data!.id
    const deleted: string[] = []
    const GAME = {
      idFromName: (name: string) => name,
      get: (id: string) => ({ fetch: async (url: string, init?: RequestInit) => { deleted.push(`${init?.method} ${id} ${url}`); return new Response(null) } }),
    } as unknown as DurableObjectNamespace
    expect(await cleanupStale({ DB: db, GAME }, new Date('2026-10-04T00:00:00Z'))).toBe(1)
    expect(deleted).toEqual([
      `POST ${tableId} https://game/tables/${tableId}/sync`,
      `DELETE ${tableId} https://game/tables/${tableId}`,
    ])
    expect((await getTable(db, tableId)).data).toBeNull()
    expect((await getTable(db, fresh)).data).not.toBeNull()
  })

  it('cleanupStale : l’échec d’une table n’arrête pas les suivantes ; table gardée si sa partie reste', async () => {
    const other = (await createTable(db, { hostPlayerId: 'p2', format: 'duel', seats: 2, eliminatedSeeAll: false })).data!.id
    const third = (await createTable(db, { hostPlayerId: 'p2', format: 'duel', seats: 2, eliminatedSeeAll: false })).data!.id
    await db.prepare("UPDATE game_tables SET last_activity_at = '2026-09-01 00:00:00'").run()
    const GAME = {
      idFromName: (name: string) => name,
      get: (id: string) => ({
        fetch: async () => {
          if (id === tableId) throw new Error('objet injoignable')
          if (id === other) return new Response(null, { status: 500 })
          return new Response(null)
        },
      }),
    } as unknown as DurableObjectNamespace
    expect(await cleanupStale({ DB: db, GAME }, new Date('2026-10-04T00:00:00Z'))).toBe(1)
    expect((await getTable(db, tableId)).data).not.toBeNull()
    expect((await getTable(db, other)).data).not.toBeNull()
    expect((await getTable(db, third)).data).toBeNull()
  })
})
