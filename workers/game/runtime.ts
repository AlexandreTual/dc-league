// Runtime d'une table : sockets, stockage du Durable Object et mises à jour D1, autour de la logique pure de room.ts.
// Testable sans Cloudflare : le stockage, les sockets, l'horloge et le hasard sont fournis.
import { finishTable, setHost, touchActivity } from '../../lib/db-games'
import {
  createRoom, handleConnect, handleDisconnect, handleMessage, mergeCards, restoreRoom, viewMessageFor,
  type CardDataMap, type ClientMessage, type Outcome, type RoomState, type ServerMessage,
} from '../../lib/game/room'
import type { GameAction, GameSetup, Seed } from '../../lib/game/types'

/** Sous-ensemble de l'API de stockage clé-valeur d'un Durable Object. */
export interface KvStorage {
  get<T>(key: string): Promise<T | undefined>
  put(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<boolean>
  list<T>(options: { prefix: string }): Promise<Map<string, T>>
  deleteAll(): Promise<void>
}

export interface Socket {
  send(data: string): void
  close(code?: number, reason?: string): void
}

export type SocketInfo = { playerId: string | null }

export type InitBody = { tableId: string; setup: GameSetup; hostId: string }

/** `finishPending` : fin de partie pas encore enregistrée en D1, à retenter (connexion suivante ou nettoyage). */
type Meta = { tableId: string; hostId: string; finished: boolean; winner: string | null; finishPending?: boolean }

/** Joueur → instant depuis lequel il est absent ; enregistré pour survivre à l'hibernation. */
type Presence = Record<string, number>

export const MAX_MESSAGE_BYTES = 16 * 1024
export const MAX_MESSAGES_PER_SECOND = 20
const ACTIVITY_EVERY_MS = 60_000
const RETRY = 'Réessaie'

const actionKey = (index: number) => `a:${String(index).padStart(6, '0')}`

export class RoomRuntime {
  private room: RoomState | null = null
  private meta: Meta | null = null
  private loaded = false
  private lastActivity = -Infinity
  /** Par socket : cartes déjà envoyées et débit. Perdu au réveil : tout est alors renvoyé. */
  private perSocket = new WeakMap<Socket, { sent: CardDataMap; windowStart: number; count: number }>()

  constructor(
    private storage: KvStorage,
    private db: D1Database,
    private sockets: () => { socket: Socket; info: SocketInfo }[],
    private clock: () => number,
    private seed: () => Seed,
  ) {}

  state(): RoomState | null {
    return this.room
  }

  /**
   * Charge la partie depuis le stockage (une fois). Connectés : d'après les sockets ouvertes ;
   * absents : depuis la date enregistrée, ou depuis maintenant si elle manque.
   */
  async load(): Promise<void> {
    if (this.loaded) return
    const [setup, meta, presence] = await Promise.all([
      this.storage.get<GameSetup>('setup'), this.storage.get<Meta>('meta'), this.storage.get<Presence>('presence'),
    ])
    if (setup && meta) {
      const actions = [...(await this.storage.list<GameAction>({ prefix: 'a:' })).values()]
      const room = restoreRoom(meta.tableId, setup, meta.hostId, actions, meta, this.clock(), presence ?? {})
      for (const { info } of this.sockets()) {
        if (info.playerId && room.seats.some((s) => s.playerId === info.playerId)) {
          room.online[info.playerId] = (room.online[info.playerId] ?? 0) + 1
          delete room.absentSince[info.playerId]
        }
      }
      this.room = room
      this.meta = meta
      if (JSON.stringify(room.absentSince) !== JSON.stringify(presence ?? {})) await this.savePresence()
    }
    this.loaded = true
  }

  /** Retente l'enregistrement en D1 d'une fin de partie restée en attente (appelé par le nettoyage). */
  async sync(): Promise<void> {
    await this.load()
    if (this.room && this.meta?.finishPending) await this.reportFinish()
  }

  async init(body: InitBody): Promise<Response> {
    await this.load()
    if (this.room) return new Response('Partie déjà créée', { status: 409 })
    const room = createRoom(body.tableId, body.setup, body.hostId, this.seed, this.clock())
    const meta: Meta = { tableId: body.tableId, hostId: body.hostId, finished: false, winner: null }
    await this.storage.put('setup', body.setup)
    await this.storage.put(actionKey(0), room.history.actions[0])
    await this.storage.put('presence', room.absentSince)
    await this.storage.put('meta', meta)
    this.room = room
    this.meta = meta
    return new Response(null, { status: 201 })
  }

  async connect(socket: Socket, info: SocketInfo): Promise<void> {
    await this.load()
    if (!this.room) return socket.close(1011, 'Partie introuvable')
    const outcome = handleConnect(this.room, info.playerId, this.clock())
    if (outcome.changed) await this.savePresence()
    if (this.meta?.finishPending) await this.reportFinish()
    await this.afterEvents(outcome)
    if (outcome.changed) this.broadcast()
    else this.sendView(socket, info)
  }

  async disconnect(_socket: Socket, info: SocketInfo): Promise<void> {
    await this.load()
    if (!this.room) return
    const outcome = handleDisconnect(this.room, info.playerId, this.clock())
    if (!outcome.changed) return
    await this.savePresence()
    this.broadcast()
  }

  async message(socket: Socket, info: SocketInfo, raw: string): Promise<void> {
    if (new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES) return
    if (!this.withinRate(socket)) return
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return

    await this.load()
    const room = this.room
    if (!room) return
    const before = room.history.actions.length
    const outcome = handleMessage(room, info.playerId, msg, { now: this.clock(), seed: this.seed })

    if (outcome.changed) {
      try {
        await this.persist(before)
      } catch {
        // Retour à l'état enregistré : l'action n'a pas eu lieu.
        this.loaded = false
        this.room = null
        await this.load()
        return this.send(socket, { type: 'rejected', error: RETRY })
      }
    }
    if (outcome.error !== null) this.send(socket, { type: 'rejected', error: outcome.error })
    if (!outcome.changed) return
    await this.afterEvents(outcome)
    this.broadcast()
  }

  async destroy(): Promise<void> {
    await this.storage.deleteAll()
    for (const { socket } of this.sockets()) {
      try {
        socket.close(1000, 'Table supprimée')
      } catch {
        // déjà fermée
      }
    }
    this.room = null
    this.meta = null
  }

  // ── Interne ──────────────────────────────────────────────────────────────

  private withinRate(socket: Socket): boolean {
    const now = this.clock()
    const s = this.socketState(socket)
    if (now - s.windowStart >= 1000) {
      s.windowStart = now
      s.count = 0
    }
    s.count++
    return s.count <= MAX_MESSAGES_PER_SECOND
  }

  private socketState(socket: Socket) {
    let s = this.perSocket.get(socket)
    if (!s) {
      s = { sent: {}, windowStart: -Infinity, count: 0 }
      this.perSocket.set(socket, s)
    }
    return s
  }

  /** Écrit les actions ajoutées ou retirées depuis `before`, puis les métadonnées si elles ont changé. */
  private async persist(before: number): Promise<void> {
    const room = this.room!
    const after = room.history.actions.length
    for (let i = before; i < after; i++) await this.storage.put(actionKey(i), room.history.actions[i])
    for (let i = after; i < before; i++) await this.storage.delete(actionKey(i))
    const meta = this.meta!
    if (meta.hostId !== room.hostId || meta.finished !== room.finished || meta.winner !== room.winner) {
      const next = { ...meta, hostId: room.hostId, finished: room.finished, winner: room.winner }
      await this.storage.put('meta', next)
      this.meta = next
    }
  }

  /** Écrit les dates d'absence ; un échec n'a pas d'effet sur la partie (au pire, l'absence repart du réveil). */
  private async savePresence(): Promise<void> {
    try {
      await this.storage.put('presence', this.room!.absentSince)
    } catch (e) {
      console.error('Présence non enregistrée', e)
    }
  }

  /** Enregistre la fin de partie en D1 ; en cas d'échec, la marque en attente pour la retenter plus tard. */
  private async reportFinish(): Promise<void> {
    const room = this.room!
    let pending: boolean
    try {
      pending = (await finishTable(this.db, room.tableId, room.winner)).error !== null
    } catch {
      pending = true
    }
    const meta = this.meta!
    if ((meta.finishPending ?? false) === pending) return
    const next = { ...meta, finishPending: pending }
    try {
      await this.storage.put('meta', next)
      this.meta = next
    } catch (e) {
      console.error('Métadonnées non enregistrées', e)
    }
  }

  /** Répercute en D1 l'activité (au plus une fois par minute), l'hôte et la fin de partie. Erreurs D1 sans effet sur la partie. */
  private async afterEvents(outcome: Outcome): Promise<void> {
    const room = this.room!
    const now = this.clock()
    try {
      if (outcome.changed && now - this.lastActivity >= ACTIVITY_EVERY_MS) {
        this.lastActivity = now
        await touchActivity(this.db, room.tableId, new Date(now))
      }
      for (const event of outcome.events) {
        if (event.type === 'hostChanged') {
          await setHost(this.db, room.tableId, event.hostId)
          if (this.meta && this.meta.hostId !== event.hostId) {
            this.meta = { ...this.meta, hostId: event.hostId }
            await this.storage.put('meta', this.meta)
          }
        }
        if (event.type === 'finished') await this.reportFinish()
      }
    } catch (e) {
      console.error('Mise à jour D1 impossible', e)
    }
  }

  private send(socket: Socket, message: ServerMessage): void {
    try {
      socket.send(JSON.stringify(message))
    } catch {
      // socket en cours de fermeture
    }
  }

  private sendView(socket: Socket, info: SocketInfo): void {
    const s = this.socketState(socket)
    const message = viewMessageFor(this.room!, info.playerId, s.sent)
    s.sent = mergeCards(s.sent, message.cards)
    this.send(socket, message)
  }

  private broadcast(): void {
    for (const { socket, info } of this.sockets()) this.sendView(socket, info)
  }
}
