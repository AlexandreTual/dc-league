import type { Env } from './env'

export { GameRoom } from './room-do'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const tableId = new URL(request.url).pathname.split('/')[2]
    if (!tableId) return new Response('Table manquante', { status: 400 })
    return env.GAME.get(env.GAME.idFromName(tableId)).fetch(request)
  },
} satisfies ExportedHandler<Env>
