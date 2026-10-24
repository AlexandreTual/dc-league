// Droits de chaque route API hors ligues et jeu en ligne : visiteur 401, joueur 403, propriétaire ou admin admis,
// écriture d'une autre origine 403. La vraie session (`requireAdmin`, `apiRoute`…) tourne : seul le cookie est simulé.
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createTestDb } from '@/test/d1'
import type { CurrentUser } from '@/lib/auth/types'

const ctx = vi.hoisted(() => ({ db: null as unknown as D1Database, user: null as CurrentUser | null }))

vi.mock('@cloudflare/next-on-pages', () => ({ getRequestContext: () => ({ env: { DB: ctx.db } }) }))
// `cache` de React n'existe que côté serveur Next : ici, une résolution par appel.
vi.mock('react', async (importOriginal) => ({ ...(await importOriginal<typeof import('react')>()), cache: <T,>(fn: T) => fn }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'jeton' }) }) }))
vi.mock('@/lib/auth/resolve', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/resolve')>()),
  resolveSession: async () => ctx.user,
}))

const adminUsers = await import('./admin/users/[id]/route')
const adminInvitations = await import('./admin/invitations/route')
const adminGames = await import('./admin/games/route')
const adminGame = await import('./admin/games/[id]/route')
const adminAi = await import('./admin/ai/route')
const adminErrors = await import('./admin/errors/route')
const players = await import('./players/route')
const playerDecks = await import('./players/[id]/decks/route')
const deck = await import('./decks/[id]/route')
const deckImportLink = await import('./decks/[id]/import/link/route')
const deckImportResolve = await import('./decks/[id]/import/resolve/route')
const deckImportCommit = await import('./decks/[id]/import/commit/route')
const playoff = await import('./playoffs/[id]/route')
const match = await import('./matches/[id]/route')
const close = await import('./leagues/[id]/close/route')
const meEmail = await import('./me/email/route')
const mePassword = await import('./me/password/route')
const meProfile = await import('./me/profile/route')
const aiQuota = await import('./ai/quota/route')
const aiAsk = await import('./ai/ask/route')
const visioIce = await import('./visio/ice/route')
const logout = await import('./auth/logout/route')

const SITE = 'http://site.test'
const user = (playerId: string, extra: Partial<CurrentUser> = {}): CurrentUser => ({
  id: `u-${playerId}`, playerId, username: playerId, isAdmin: false, playerName: playerId, avatarUrl: null, isBootstrap: false, ...extra,
})
const ADMIN = user('adm', { isAdmin: true })
const PLAYER = user('pla')
const OTHER = user('aut')
const ORGANIZER = user('org')
const BOOTSTRAP = user('boot', { isBootstrap: true, id: 'bootstrap' })

function req(method: string, path: string, body?: unknown, origin = SITE) {
  return new NextRequest(`${SITE}${path}`, {
    method,
    headers: { origin, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) })

beforeEach(async () => {
  ctx.db = createTestDb()
  ctx.user = null
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO players (id, name) VALUES ('adm', 'Admin'), ('pla', 'Joueur'), ('aut', 'Autre'), ('org', 'Orga'), ('boot', 'Démarrage')"),
    ctx.db.prepare("INSERT INTO users (id, player_id, username, is_admin) VALUES ('u-adm', 'adm', 'adm', 1), ('u-pla', 'pla', 'pla', 0), ('u-aut', 'aut', 'aut', 0), ('u-org', 'org', 'org', 0)"),
    ctx.db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d-pla', 'pla', 'Deck du joueur')"),
    ctx.db.prepare("INSERT INTO leagues (id, name, owner_player_id, visibility) VALUES ('lg', 'Ligue', 'org', 'public')"),
    ctx.db.prepare("INSERT INTO league_players (league_id, player_id) VALUES ('lg', 'pla'), ('lg', 'aut'), ('lg', 'org')"),
    ctx.db.prepare("INSERT INTO matches (id, player1_id, player2_id, league_id) VALUES ('m1', 'pla', 'aut', 'lg')"),
    ctx.db.prepare("INSERT INTO playoffs (id, stage, player1_id, player2_id, league_id) VALUES ('po1', 'semi1', 'pla', 'aut', 'lg')"),
  ])
})

const as = (u: CurrentUser | null) => { ctx.user = u }
const status = async (u: CurrentUser | null, call: () => Promise<Response>) => { as(u); return (await call()).status }
const isAdmin = async (id: string) => (await ctx.db.prepare('SELECT is_admin FROM users WHERE id = ?').bind(id).first<{ is_admin: number }>())?.is_admin
const exists = async (table: string, id: string) => !!(await ctx.db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).bind(id).first())
const score = async (table: 'matches' | 'playoffs', id: string) =>
  (await ctx.db.prepare(`SELECT score_p1 FROM ${table} WHERE id = ?`).bind(id).first<{ score_p1: number | null }>())?.score_p1 ?? null

type Route = { name: string; call: (origin?: string) => Promise<Response>; write: boolean }

/** Routes réservées aux admins. */
const ADMIN_ROUTES: Route[] = [
  { name: 'PATCH admin/users/[id]', write: true, call: (o) => adminUsers.PATCH(req('PATCH', '/api/admin/users/u-pla', { is_admin: true }, o), params({ id: 'u-pla' })) },
  { name: 'POST admin/invitations', write: true, call: (o) => adminInvitations.POST(req('POST', '/api/admin/invitations', { player_id: 'boot', kind: 'signup' }, o)) },
  { name: 'GET admin/games', write: false, call: () => adminGames.GET(req('GET', '/api/admin/games')) },
  { name: 'DELETE admin/games/[id]', write: true, call: (o) => adminGame.DELETE(req('DELETE', '/api/admin/games/t1', undefined, o), params({ id: 't1' })) },
  { name: 'GET admin/ai', write: false, call: () => adminAi.GET(req('GET', '/api/admin/ai')) },
  { name: 'PATCH admin/ai', write: true, call: (o) => adminAi.PATCH(req('PATCH', '/api/admin/ai', { enabled: false }, o)) },
  { name: 'DELETE admin/errors', write: true, call: (o) => adminErrors.DELETE(req('DELETE', '/api/admin/errors', {}, o)) },
  { name: 'POST players', write: true, call: (o) => players.POST(req('POST', '/api/players', { name: 'Nouveau' }, o)) },
  { name: 'DELETE players', write: true, call: (o) => players.DELETE(req('DELETE', '/api/players', { id: 'aut' }, o)) },
]

/** Routes d'un vrai compte joueur (la session de démarrage est refusée). */
const PLAYER_ROUTES: Route[] = [
  { name: 'PATCH me/email', write: true, call: (o) => meEmail.PATCH(req('PATCH', '/api/me/email', { email: 'a@b.fr', currentPassword: 'x' }, o)) },
  { name: 'PATCH me/password', write: true, call: (o) => mePassword.PATCH(req('PATCH', '/api/me/password', { currentPassword: 'x', newPassword: 'y' }, o)) },
  { name: 'PATCH me/profile', write: true, call: (o) => meProfile.PATCH(req('PATCH', '/api/me/profile', { name: 'Nom' }, o)) },
]

/** Routes d'un joueur connecté. */
const USER_ROUTES: Route[] = [
  { name: 'GET ai/quota', write: false, call: () => aiQuota.GET(req('GET', '/api/ai/quota')) },
  { name: 'POST ai/ask', write: true, call: (o) => aiAsk.POST(req('POST', '/api/ai/ask', { question: 'Bonjour ?' }, o)) },
  { name: 'POST players/[id]/decks', write: true, call: (o) => playerDecks.POST(req('POST', '/api/players/pla/decks', { name: 'Deck' }, o), params({ id: 'pla' })) },
]

/** Routes d'un deck : son propriétaire (ou un admin). */
const DECK_ROUTES: Route[] = [
  { name: 'PATCH decks/[id]', write: true, call: (o) => deck.PATCH(req('PATCH', '/api/decks/d-pla', { name: 'Renommé' }, o), params({ id: 'd-pla' })) },
  { name: 'DELETE decks/[id]', write: true, call: (o) => deck.DELETE(req('DELETE', '/api/decks/d-pla', undefined, o), params({ id: 'd-pla' })) },
  { name: 'POST decks/[id]/import/link', write: true, call: (o) => deckImportLink.POST(req('POST', '/api/decks/d-pla/import/link', {}, o), params({ id: 'd-pla' })) },
  { name: 'POST decks/[id]/import/resolve', write: true, call: (o) => deckImportResolve.POST(req('POST', '/api/decks/d-pla/import/resolve', {}, o), params({ id: 'd-pla' })) },
  { name: 'POST decks/[id]/import/commit', write: true, call: (o) => deckImportCommit.POST(req('POST', '/api/decks/d-pla/import/commit', {}, o), params({ id: 'd-pla' })) },
]

/** Routes qui gèrent une ligue : organisateur ou admin. */
const MANAGE_ROUTES: Route[] = [
  { name: 'PATCH playoffs/[id]', write: true, call: (o) => playoff.PATCH(req('PATCH', '/api/playoffs/po1', { score_p1: 2, score_p2: 0 }, o), params({ id: 'po1' })) },
  { name: 'DELETE playoffs/[id]', write: true, call: (o) => playoff.DELETE(req('DELETE', '/api/playoffs/po1', undefined, o), params({ id: 'po1' })) },
  { name: 'PATCH matches/[id]', write: true, call: (o) => match.PATCH(req('PATCH', '/api/matches/m1', { score_p1: 2, score_p2: 1 }, o), params({ id: 'm1' })) },
  { name: 'DELETE matches/[id]', write: true, call: (o) => match.DELETE(req('DELETE', '/api/matches/m1', undefined, o), params({ id: 'm1' })) },
  { name: 'POST leagues/[id]/close', write: true, call: (o) => close.POST(req('POST', '/api/leagues/lg/close', {}, o), params({ id: 'lg' })) },
]

const DENIED = [401, 403]

describe('routes admin', () => {
  for (const r of ADMIN_ROUTES) {
    it(`${r.name} : visiteur 401, joueur 403, admin admis${r.write ? ', autre origine 403' : ''}`, async () => {
      expect(await status(null, r.call)).toBe(401)
      expect(await status(PLAYER, r.call)).toBe(403)
      expect(await status(ORGANIZER, r.call)).toBe(403)
      if (r.write) expect(await status(ADMIN, () => r.call('http://evil.test'))).toBe(403)
      expect(DENIED).not.toContain(await status(ADMIN, r.call))
    })
  }

  it('un joueur ne peut pas se nommer admin ; un admin le peut', async () => {
    const call = () => adminUsers.PATCH(req('PATCH', '/api/admin/users/u-pla', { is_admin: true }), params({ id: 'u-pla' }))
    expect(await status(PLAYER, call)).toBe(403)
    expect(await isAdmin('u-pla')).toBe(0)
    expect(await status(ADMIN, call)).toBe(200)
    expect(await isAdmin('u-pla')).toBe(1)
  })

  it('un joueur ne supprime pas un autre joueur ; un admin le peut', async () => {
    const call = () => players.DELETE(req('DELETE', '/api/players', { id: 'aut' }))
    expect(await status(PLAYER, call)).toBe(403)
    expect(await exists('players', 'aut')).toBe(true)
  })

  it('session de démarrage : admise partout dans l’administration, pour créer le premier admin', async () => {
    expect(await status(BOOTSTRAP, () => adminGames.GET(req('GET', '/api/admin/games')))).toBe(200)
    expect(await status(BOOTSTRAP, () => adminInvitations.POST(req('POST', '/api/admin/invitations', { player_id: 'boot', kind: 'signup', grant_admin: true })))).toBe(201)
    expect(await status(BOOTSTRAP, () => adminUsers.PATCH(req('PATCH', '/api/admin/users/u-pla', { is_admin: true }), params({ id: 'u-pla' })))).toBe(200)
  })
})

describe('routes du compte joueur', () => {
  for (const r of PLAYER_ROUTES) {
    it(`${r.name} : visiteur 401, session de démarrage 403, autre origine 403, joueur admis`, async () => {
      expect(await status(null, r.call)).toBe(401)
      expect(await status(BOOTSTRAP, r.call)).toBe(403)
      expect(await status(PLAYER, () => r.call('http://evil.test'))).toBe(403)
      expect(DENIED).not.toContain(await status(PLAYER, r.call))
    })
  }
})

describe('routes d’un joueur connecté', () => {
  for (const r of USER_ROUTES) {
    it(`${r.name} : visiteur 401${r.write ? ', autre origine 403' : ''}`, async () => {
      expect(await status(null, r.call)).toBe(401)
      if (r.write) expect(await status(PLAYER, () => r.call('http://evil.test'))).toBe(403)
    })
  }

  it('POST players/[id]/decks : seulement pour soi, sauf admin', async () => {
    const call = () => playerDecks.POST(req('POST', '/api/players/pla/decks', { name: 'Deck' }), params({ id: 'pla' }))
    expect(await status(OTHER, call)).toBe(403)
    expect(DENIED).not.toContain(await status(PLAYER, call))
    expect(DENIED).not.toContain(await status(ADMIN, call))
  })

  it('GET visio/ice : visiteur et session de démarrage 401', async () => {
    expect(await status(null, () => visioIce.GET())).toBe(401)
    expect(await status(BOOTSTRAP, () => visioIce.GET())).toBe(401)
  })

  it('POST auth/logout : autre origine 403', async () => {
    expect(await status(PLAYER, () => logout.POST(req('POST', '/api/auth/logout', undefined, 'http://evil.test')))).toBe(403)
  })
})

describe('routes d’un deck', () => {
  for (const r of DECK_ROUTES) {
    it(`${r.name} : visiteur 401, autre joueur 403, autre origine 403, propriétaire et admin admis`, async () => {
      expect(await status(null, r.call)).toBe(401)
      expect(await status(OTHER, r.call)).toBe(403)
      expect(await status(PLAYER, () => r.call('http://evil.test'))).toBe(403)
      expect(DENIED).not.toContain(await status(ADMIN, r.call))
      expect(DENIED).not.toContain(await status(PLAYER, r.call))
    })
  }

  it('deck introuvable : 404', async () => {
    expect(await status(PLAYER, () => deck.PATCH(req('PATCH', '/api/decks/zz', { name: 'X' }), params({ id: 'zz' })))).toBe(404)
  })

  it('un autre joueur ne supprime pas le deck', async () => {
    await status(OTHER, () => deck.DELETE(req('DELETE', '/api/decks/d-pla'), params({ id: 'd-pla' })))
    expect(await exists('decks', 'd-pla')).toBe(true)
  })
})

describe('routes qui gèrent une ligue', () => {
  for (const r of MANAGE_ROUTES) {
    it(`${r.name} : visiteur 401, joueur de la ligue 403, autre origine 403, organisateur et admin admis`, async () => {
      expect(await status(null, r.call)).toBe(401)
      expect(await status(PLAYER, r.call)).toBe(403)
      expect(await status(ORGANIZER, () => r.call('http://evil.test'))).toBe(403)
      expect(DENIED).not.toContain(await status(ORGANIZER, r.call))
      expect(DENIED).not.toContain(await status(ADMIN, r.call))
    })
  }

  it('un joueur du match ne saisit pas le score (pas encore : saisie par les joueurs à venir)', async () => {
    await status(PLAYER, () => match.PATCH(req('PATCH', '/api/matches/m1', { score_p1: 2, score_p2: 0 }), params({ id: 'm1' })))
    await status(PLAYER, () => playoff.PATCH(req('PATCH', '/api/playoffs/po1', { score_p1: 2, score_p2: 0 }), params({ id: 'po1' })))
    expect(await score('matches', 'm1')).toBeNull()
    expect(await score('playoffs', 'po1')).toBeNull()
  })

  it('match ou playoff introuvable : 404, sans rien dire de plus', async () => {
    expect(await status(ORGANIZER, () => match.PATCH(req('PATCH', '/api/matches/zz', { score_p1: 2, score_p2: 0 }), params({ id: 'zz' })))).toBe(404)
    expect(await status(ORGANIZER, () => playoff.DELETE(req('DELETE', '/api/playoffs/zz'), params({ id: 'zz' })))).toBe(404)
  })
})
