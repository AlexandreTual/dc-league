import { cleanupStale } from './cleanup'
import type { Env } from './env'

export { GameRoom } from './room-do'

/** Requêtes de la forme /tables/<id>/… transmises au Durable Object de la table. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const [, kind, tableId] = new URL(request.url).pathname.split('/')
    if (kind !== 'tables' || !tableId) return new Response('Introuvable', { status: 404 })
    return env.GAME.get(env.GAME.idFromName(tableId)).fetch(request)
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const deleted = await cleanupStale(env, new Date())
    console.log(`Nettoyage : ${deleted} table(s) supprimée(s)`)
  },
} satisfies ExportedHandler<Env>
