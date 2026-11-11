import { describe, it, expect, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { createTestDb } from '@/test/d1'
import { handleApi, type ApiDeps } from '@/lib/auth/api-core'
import type { CurrentUser } from '@/lib/auth/types'
import { listErrors } from '@/lib/db-errors'
import { editableDeck } from './deck-access'

const URL_API = 'https://league.example.com/api/decks/d1/commander'
const user = (over: Partial<CurrentUser> = {}): CurrentUser => ({
  id: 'u1', playerId: 'p1', username: 'alex', isAdmin: false, playerName: 'Alex', avatarUrl: null, isBootstrap: false, ...over,
})

let db: D1Database
beforeEach(async () => {
  db = createTestDb()
  await db.prepare("INSERT INTO players (id, name) VALUES ('p1', 'Alex'), ('p2', 'Bob')").run()
  await db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d1', 'p1', 'Atraxa')").run()
})

const deps = (current: CurrentUser | null, base: D1Database = db): ApiDeps => ({
  getUser: async () => current,
  getEnv: () => ({ DB: base }) as unknown as CloudflareEnv,
})
const call = (current: CurrentUser | null, body = '{}', id = 'd1', base?: D1Database) =>
  handleApi(
    new Request(URL_API, { method: 'PATCH', body }),
    'user',
    editableDeck(Promise.resolve({ id }), async ({ deck, body }) => NextResponse.json({ deck: deck.id, position: body.position ?? null })),
    deps(current, base),
  )

describe('editableDeck', () => {
  it('passe le deck à son propriétaire et à un admin', async () => {
    expect(await (await call(user(), '{"position":3}')).json()).toEqual({ deck: 'd1', position: 3 })
    expect((await call(user({ id: 'u2', playerId: 'p2', isAdmin: true }))).status).toBe(200)
  })

  it('401 sans connexion, 403 pour le deck d’un autre, 404 pour un deck inconnu', async () => {
    const anonymous = await call(null)
    expect([anonymous.status, await anonymous.json()]).toEqual([401, { error: 'Connexion requise' }])
    const other = await call(user({ id: 'u2', playerId: 'p2' }))
    expect([other.status, await other.json()]).toEqual([403, { error: 'Tu ne peux gérer que tes propres decks' }])
    const missing = await call(user(), '{}', 'inconnu')
    expect([missing.status, await missing.json()]).toEqual([404, { error: 'Deck introuvable' }])
  })

  it('un corps JSON null ou illisible donne une 400 en français, pas une 500', async () => {
    for (const body of ['null', '[1]', '{oups']) {
      const res = await call(user(), body)
      expect([res.status, await res.json()]).toEqual([400, { error: 'Requête invalide' }])
    }
  })

  it('une base en panne donne une 500 en français, notée dans le journal des erreurs', async () => {
    const broken = new Proxy(db, {
      get: (target, key) =>
        key === 'prepare'
          ? (sql: string) => {
              if (sql.includes('FROM decks')) throw new Error('D1_ERROR: panne')
              return target.prepare(sql)
            }
          : Reflect.get(target, key),
    })
    const res = await call(user(), '{}', 'd1', broken)
    expect([res.status, await res.json()]).toEqual([500, { error: 'Erreur interne, réessaie plus tard' }])
    expect((await listErrors(db)).data![0]).toMatchObject({ source: 'serveur', message: 'D1_ERROR: panne', path: 'PATCH /api/decks/d1/commander' })
  })
})
