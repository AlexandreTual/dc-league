import { DurableObject } from 'cloudflare:workers'
import { randomSeed } from '../../lib/game/random'
import type { Env } from './env'
import { RoomRuntime, type InitBody, type SocketInfo } from './runtime'

/**
 * Une table en ligne. Enveloppe fine autour de RoomRuntime : WebSockets à hibernation,
 * stockage du Durable Object. Routes (appelées par le site seulement, via la liaison GAME) :
 *   POST /tables/<id>/init   — crée la partie (corps InitBody)
 *   GET  /tables/<id>/ws     — WebSocket ; X-Player-Id (joueur) ou X-Spectator (spectateur)
 *   POST /tables/<id>/sync   — retente l'enregistrement en D1 d'une fin de partie (nettoyage)
 *   DELETE /tables/<id>      — supprime la partie (nettoyage)
 */
export class GameRoom extends DurableObject<Env> {
  private runtime = new RoomRuntime(
    this.ctx.storage,
    this.env.DB,
    () => this.ctx.getWebSockets().map((ws) => ({ socket: ws, info: ws.deserializeAttachment() as SocketInfo })),
    () => Date.now(),
    randomSeed,
  )

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname
    if (request.method === 'DELETE') {
      await this.runtime.destroy()
      return new Response(null, { status: 204 })
    }
    if (request.method === 'POST' && path.endsWith('/sync')) {
      await this.runtime.sync()
      return new Response(null, { status: 204 })
    }
    if (request.method === 'POST' && path.endsWith('/init')) {
      return this.runtime.init((await request.json()) as InitBody)
    }
    if (path.endsWith('/ws')) {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendue', { status: 426 })
      await this.runtime.load()
      if (!this.runtime.state()) return new Response('Partie introuvable', { status: 404 })
      const info: SocketInfo = { playerId: request.headers.get('X-Player-Id') || null }
      const [client, server] = Object.values(new WebSocketPair())
      this.ctx.acceptWebSocket(server)
      server.serializeAttachment(info)
      await this.runtime.connect(server, info)
      return new Response(null, { status: 101, webSocket: client })
    }
    return new Response('Introuvable', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return
    await this.runtime.message(ws, ws.deserializeAttachment() as SocketInfo, message)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.runtime.disconnect(ws, ws.deserializeAttachment() as SocketInfo)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.runtime.disconnect(ws, ws.deserializeAttachment() as SocketInfo)
  }
}
