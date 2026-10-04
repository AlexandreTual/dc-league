import { DurableObject } from 'cloudflare:workers'
import type { Env } from './env'

/** Version provisoire (Tâche 1) : renvoie chaque message avec l'identité transmise par le site. */
export class GameRoom extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket attendue', { status: 426 })
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ playerId: request.headers.get('X-Player-Id') })
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const { playerId } = ws.deserializeAttachment() as { playerId: string | null }
    ws.send(JSON.stringify({ echo: String(message), player: playerId }))
  }
}
