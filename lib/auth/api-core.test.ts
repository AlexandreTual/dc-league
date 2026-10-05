import { describe, it, expect, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { handleApi, dbFailure, resultError, INTERNAL_ERROR, type ApiDeps } from './api-core'
import type { CurrentUser } from './types'
import { ERREURS_LIGUE, STATUTS_LIGUE } from '@/lib/db'

const URL_API = 'https://league.example.com/api/players'
const db = {} as D1Database

const user = (over: Partial<CurrentUser> = {}): CurrentUser => ({
  id: 'u1',
  playerId: 'p1',
  username: 'alex',
  isAdmin: false,
  playerName: 'Alex',
  avatarUrl: null,
  isBootstrap: false,
  ...over,
})

function deps(current: CurrentUser | null = null): ApiDeps {
  return { getUser: async () => current, getEnv: () => ({ DB: db }) as unknown as CloudflareEnv }
}

function req(method: string, body?: string, headers: Record<string, string> = {}) {
  return new Request(URL_API, { method, body, headers })
}

const echo = vi.fn(async (ctx: { body: Record<string, unknown> }) => NextResponse.json({ body: ctx.body }))

describe('handleApi', () => {
  it("refuse une écriture venant d'un autre site", async () => {
    const res = await handleApi(req('POST', '{}', { Origin: 'https://evil.com' }), 'admin', echo, deps(user({ isAdmin: true })))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Origine refusée' })
  })

  it('ne contrôle pas l’origine des lectures', async () => {
    const res = await handleApi(req('GET', undefined, { Origin: 'https://evil.com' }), 'public', echo, deps())
    expect(res.status).toBe(200)
  })

  it('admin : 401 sans session, 403 pour un joueur, accepte admin et session de démarrage', async () => {
    expect((await handleApi(req('POST', '{}'), 'admin', echo, deps())).status).toBe(401)
    const player = await handleApi(req('POST', '{}'), 'admin', echo, deps(user()))
    expect(player.status).toBe(403)
    expect(await player.json()).toEqual({ error: 'Accès réservé aux admins' })
    expect((await handleApi(req('POST', '{}'), 'admin', echo, deps(user({ isAdmin: true })))).status).toBe(200)
    expect((await handleApi(req('POST', '{}'), 'admin', echo, deps(user({ isBootstrap: true })))).status).toBe(200)
  })

  it('user : 401 sans session ; player : 403 pour la session de démarrage', async () => {
    const anon = await handleApi(req('POST', '{}'), 'user', echo, deps())
    expect(anon.status).toBe(401)
    expect(await anon.json()).toEqual({ error: 'Connexion requise' })
    expect((await handleApi(req('POST', '{}'), 'player', echo, deps(user({ isBootstrap: true })))).status).toBe(403)
    expect((await handleApi(req('POST', '{}'), 'player', echo, deps(user()))).status).toBe(200)
  })

  it('lit le corps JSON (objet)', async () => {
    const res = await handleApi(req('POST', '{"name":"Bob"}'), 'public', echo, deps())
    expect(await res.json()).toEqual({ body: { name: 'Bob' } })
  })

  it('corps vide = objet vide', async () => {
    const res = await handleApi(req('DELETE'), 'public', echo, deps())
    expect(await res.json()).toEqual({ body: {} })
  })

  it.each(['{pas du json', '[1,2]', '42', 'null', '"texte"'])('refuse le corps %s en 400', async (body) => {
    const res = await handleApi(req('POST', body), 'public', echo, deps())
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Requête invalide' })
  })

  it('transforme une exception en 500 générique en français, journalisée', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await handleApi(req('POST', '{}'), 'public', async () => {
      throw new Error('D1_ERROR: no such table: players')
    }, deps())
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: INTERNAL_ERROR })
    expect(log).toHaveBeenCalled()
    log.mockRestore()
  })

  it('transmet la base et le joueur au traitement', async () => {
    const current = user({ isAdmin: true })
    await handleApi(req('POST', '{}'), 'admin', async (ctx) => {
      expect(ctx.db).toBe(db)
      expect(ctx.user).toBe(current)
      return NextResponse.json({})
    }, deps(current))
  })
})

describe('resultError', () => {
  it('renvoie un message métier connu avec son statut', async () => {
    const res = resultError('Une ligue est déjà active.', { 'Une ligue est déjà active.': 409 })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Une ligue est déjà active.' })
  })

  it('masque un message inconnu (D1)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = resultError('D1_ERROR: no such column: foo', { 'Une ligue est déjà active.': 409 })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: INTERNAL_ERROR })
    log.mockRestore()
  })

  it('erreurs métier de la ligue : 404 ou 409 avec leur message, jamais la 500 générique', async () => {
    const expected: [string, number][] = [
      [ERREURS_LIGUE.matchNotFound, 404], [ERREURS_LIGUE.playoffNotFound, 404],
      [ERREURS_LIGUE.matchesExist, 409], [ERREURS_LIGUE.playoffsExist, 409],
      [ERREURS_LIGUE.leagueClosed, 409], [ERREURS_LIGUE.finalScored, 409],
    ]
    for (const [error, status] of expected) {
      const res = resultError(error, STATUTS_LIGUE)
      expect(res.status).toBe(status)
      expect(await res.json()).toEqual({ error })
    }
  })
})

describe('dbFailure', () => {
  it("n'envoie pas le message de D1 au client", async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = dbFailure('D1_ERROR: UNIQUE constraint failed: players.name')
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: INTERNAL_ERROR })
    expect(log).toHaveBeenCalledWith('[api]', 'D1_ERROR: UNIQUE constraint failed: players.name')
    log.mockRestore()
  })
})
