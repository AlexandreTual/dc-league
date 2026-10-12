// Routes des ligues : qui peut créer, voir, gérer, rejoindre (spec 2026-10-12-user-leagues-design).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestDb } from '@/test/d1'
import type { CurrentUser } from '@/lib/auth/types'
import { getInviteToken, isLeagueMember, getLeague } from '@/lib/db-leagues'

const ctx = vi.hoisted(() => ({ db: null as unknown as D1Database, user: null as CurrentUser | null }))

vi.mock('@cloudflare/next-on-pages', () => ({ getRequestContext: () => ({ env: { DB: ctx.db } }) }))
vi.mock('@/lib/auth/session', () => ({ getCurrentUser: async () => ctx.user }))

const leagues = await import('./route')
const league = await import('./[id]/route')
const invite = await import('./[id]/invite/route')
const join = await import('./join/route')
const players = await import('./[id]/players/route')
const entry = await import('./[id]/players/[playerId]/route')
const matches = await import('./[id]/matches/route')
const playoffs = await import('./[id]/playoffs/route')
const match = await import('../matches/[id]/route')

const SITE = 'http://site.test'
const user = (playerId: string, isAdmin = false): CurrentUser => ({
  id: `u-${playerId}`, playerId, username: playerId, isAdmin, playerName: playerId, avatarUrl: null, isBootstrap: false,
})
const as = (u: CurrentUser | null) => { ctx.user = u }

function req(method: string, path: string, body?: unknown) {
  return new Request(`${SITE}${path}`, {
    method,
    headers: { origin: SITE, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as never
}
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) })
const json = async (res: Response) => (await res.json()) as Record<string, unknown>

beforeEach(async () => {
  ctx.db = createTestDb()
  ctx.user = null
  await ctx.db.batch([
    ctx.db.prepare("INSERT INTO players (id, name) VALUES ('org', 'Orga'), ('mem', 'Membre'), ('out', 'Dehors'), ('adm', 'Admin'), ('p4', 'Quatre')"),
    ctx.db.prepare("INSERT INTO leagues (id, name, owner_player_id, visibility) VALUES ('priv', 'Privée', 'org', 'private'), ('pub', 'Publique', 'org', 'public')"),
    ctx.db.prepare("INSERT INTO league_players (league_id, player_id) VALUES ('priv', 'mem'), ('priv', 'org')"),
    ctx.db.prepare("INSERT INTO decks (id, player_id, name) VALUES ('d-mem', 'mem', 'Deck du membre'), ('d-out', 'out', 'Deck de Dehors')"),
  ])
})

describe('POST /api/leagues', () => {
  it('un joueur crée une ligue, en devient l’organisateur et y est inscrit', async () => {
    as(user('out'))
    const res = await leagues.POST(req('POST', '/api/leagues', { name: '  Ligue des potes ', visibility: 'private' }))
    expect(res.status).toBe(201)
    const created = await json(res)
    expect(created).toMatchObject({ name: 'Ligue des potes', owner_player_id: 'out', visibility: 'private', is_active: true })
    expect((await isLeagueMember(ctx.db, created.id as string, 'out')).data).toBe(true)
  })

  it('publique par défaut ; visibilité invalide refusée', async () => {
    as(user('out'))
    expect(await json(await leagues.POST(req('POST', '/api/leagues', { name: 'A' })))).toMatchObject({ visibility: 'public' })
    const bad = await leagues.POST(req('POST', '/api/leagues', { name: 'B', visibility: 'secrète' }))
    expect(bad.status).toBe(400)
  })

  it('visiteur : 401', async () => {
    expect((await leagues.POST(req('POST', '/api/leagues', { name: 'A' }))).status).toBe(401)
  })
})

describe('GET /api/leagues', () => {
  const ids = async () => ((await json(await leagues.GET(req('GET', '/api/leagues')))) as unknown as { id: string }[]).map((l) => l.id).sort()

  it('visiteur : publiques seulement ; membre : aussi sa privée', async () => {
    expect(await ids()).toEqual(['pub'])
    as(user('mem'))
    expect(await ids()).toEqual(['priv', 'pub'])
  })
})

describe('PATCH et DELETE /api/leagues/[id]', () => {
  it('l’organisateur renomme et rend publique ; un membre ne peut pas', async () => {
    as(user('mem'))
    expect((await league.PATCH(req('PATCH', '/api/leagues/priv', { name: 'X' }), params({ id: 'priv' }))).status).toBe(403)
    as(user('org'))
    const res = await league.PATCH(req('PATCH', '/api/leagues/priv', { name: 'Nouvelle', visibility: 'public' }), params({ id: 'priv' }))
    expect(await json(res)).toMatchObject({ name: 'Nouvelle', visibility: 'public' })
  })

  it('ligue privée vue par un non-membre : 404', async () => {
    as(user('out'))
    expect((await league.PATCH(req('PATCH', '/api/leagues/priv', { name: 'X' }), params({ id: 'priv' }))).status).toBe(404)
  })

  it('l’organisateur ne supprime pas une ligue avec des scores ; l’admin si', async () => {
    await ctx.db.prepare("INSERT INTO matches (id, player1_id, player2_id, league_id, score_p1, score_p2, is_completed) VALUES ('m', 'org', 'mem', 'priv', 2, 0, 1)").run()
    as(user('org'))
    const refused = await league.DELETE(req('DELETE', '/api/leagues/priv'), params({ id: 'priv' }))
    expect(refused.status).toBe(400)
    expect((await json(refused)).error).toBe('Des scores sont déjà saisis : seul un admin peut supprimer cette ligue.')
    as(user('adm', true))
    expect((await league.DELETE(req('DELETE', '/api/leagues/priv'), params({ id: 'priv' }))).status).toBe(200)
    expect((await getLeague(ctx.db, 'priv')).data).toBeNull()
  })

  it('l’organisateur supprime sa ligue sans score', async () => {
    as(user('org'))
    expect((await league.DELETE(req('DELETE', '/api/leagues/pub'), params({ id: 'pub' }))).status).toBe(200)
  })
})

describe('lien d’invitation', () => {
  async function newToken() {
    as(user('org'))
    const res = await invite.POST(req('POST', '/api/leagues/priv/invite'), params({ id: 'priv' }))
    return (await json(res)).token as string
  }

  it('l’organisateur crée puis renouvelle le lien ; un membre ne peut pas', async () => {
    const a = await newToken()
    const b = await newToken()
    expect(a).not.toBe(b)
    expect((await getInviteToken(ctx.db, 'priv')).data).toBe(b)
    as(user('mem'))
    expect((await invite.POST(req('POST', '/api/leagues/priv/invite'), params({ id: 'priv' }))).status).toBe(403)
  })

  it('un joueur rejoint avec le bon jeton', async () => {
    const token = await newToken()
    as(user('out'))
    const res = await join.POST(req('POST', '/api/leagues/join', { token }))
    expect(res.status).toBe(201)
    expect(await json(res)).toEqual({ league_id: 'priv' })
    expect((await isLeagueMember(ctx.db, 'priv', 'out')).data).toBe(true)
    expect(await json(await join.POST(req('POST', '/api/leagues/join', { token })))).toEqual({ league_id: 'priv', already: true })
  })

  it('jeton renouvelé ou inconnu : 404 avec un message clair', async () => {
    const old = await newToken()
    await newToken()
    as(user('out'))
    const res = await join.POST(req('POST', '/api/leagues/join', { token: old }))
    expect(res.status).toBe(404)
    expect((await json(res)).error).toBe("Ce lien d'invitation n'est plus valable. Demande-en un nouveau à l'organisateur.")
  })

  it('refus si les matchs sont générés ou la ligue terminée ; visiteur 401', async () => {
    const token = await newToken()
    await ctx.db.prepare("INSERT INTO matches (id, player1_id, player2_id, league_id) VALUES ('m', 'org', 'mem', 'priv')").run()
    as(user('out'))
    const late = await join.POST(req('POST', '/api/leagues/join', { token }))
    expect(late.status).toBe(400)
    expect((await json(late)).error).toBe('Les matchs ont déjà été générés : impossible de rejoindre cette ligue.')
    await ctx.db.prepare("UPDATE leagues SET is_active = 0 WHERE id = 'priv'").run()
    expect((await json(await join.POST(req('POST', '/api/leagues/join', { token })))).error).toBe('Cette ligue est terminée.')
    as(null)
    expect((await join.POST(req('POST', '/api/leagues/join', { token }))).status).toBe(401)
  })
})

describe('inscriptions', () => {
  it('l’organisateur inscrit un joueur ; un membre non', async () => {
    as(user('mem'))
    expect((await players.POST(req('POST', '/api/leagues/priv/players', { player_id: 'out' }), params({ id: 'priv' }))).status).toBe(403)
    as(user('org'))
    expect((await players.POST(req('POST', '/api/leagues/priv/players', { player_id: 'out' }), params({ id: 'priv' }))).status).toBe(201)
  })

  it('le joueur choisit son propre deck, pas celui d’un autre', async () => {
    as(user('mem'))
    const ok = await entry.PATCH(req('PATCH', '/api/leagues/priv/players/mem', { deck_id: 'd-mem' }), params({ id: 'priv', playerId: 'mem' }))
    expect(ok.status).toBe(200)
    const bad = await entry.PATCH(req('PATCH', '/api/leagues/priv/players/mem', { deck_id: 'd-out' }), params({ id: 'priv', playerId: 'mem' }))
    expect(bad.status).toBe(400)
    expect((await json(bad)).error).toBe("Ce deck n'appartient pas à ce joueur.")
  })

  it('un joueur ne touche pas à l’inscription d’un autre', async () => {
    as(user('mem'))
    expect((await entry.PATCH(req('PATCH', '/api/leagues/priv/players/org', { deck_id: null }), params({ id: 'priv', playerId: 'org' }))).status).toBe(403)
    expect((await entry.DELETE(req('DELETE', '/api/leagues/priv/players/org'), params({ id: 'priv', playerId: 'org' }))).status).toBe(403)
  })

  it('choisir un deck sans être inscrit : 404, sans inscrire', async () => {
    as(user('org'))
    const res = await entry.PATCH(req('PATCH', '/api/leagues/pub/players/out', { deck_id: null }), params({ id: 'pub', playerId: 'out' }))
    expect(res.status).toBe(404)
    expect((await isLeagueMember(ctx.db, 'pub', 'out')).data).toBe(false)
  })

  it('quitter la ligue avant la génération des matchs, pas après', async () => {
    as(user('mem'))
    expect((await entry.DELETE(req('DELETE', '/api/leagues/priv/players/mem'), params({ id: 'priv', playerId: 'mem' }))).status).toBe(200)
    await ctx.db.prepare("INSERT INTO league_players (league_id, player_id) VALUES ('priv', 'mem')").run()
    await ctx.db.prepare("INSERT INTO matches (id, player1_id, player2_id, league_id) VALUES ('m', 'org', 'mem', 'priv')").run()
    expect((await entry.DELETE(req('DELETE', '/api/leagues/priv/players/mem'), params({ id: 'priv', playerId: 'mem' }))).status).toBe(400)
  })
})

describe('matchs et scores', () => {
  it('l’organisateur génère le round-robin ; un membre non', async () => {
    as(user('mem'))
    expect((await matches.POST(req('POST', '/api/leagues/priv/matches'), params({ id: 'priv' }))).status).toBe(403)
    as(user('org'))
    const res = await matches.POST(req('POST', '/api/leagues/priv/matches'), params({ id: 'priv' }))
    expect(res.status).toBe(201)
    expect((await json(res)).count).toBe(1)
  })

  it('ligue terminée : génération refusée', async () => {
    await ctx.db.prepare("UPDATE leagues SET is_active = 0 WHERE id = 'priv'").run()
    as(user('org'))
    const res = await matches.POST(req('POST', '/api/leagues/priv/matches'), params({ id: 'priv' }))
    expect(res.status).toBe(400)
  })

  it('score : organisateur de la ligue du match seulement', async () => {
    await ctx.db.batch([
      ctx.db.prepare("INSERT INTO leagues (id, name, owner_player_id) VALUES ('autre', 'Autre', 'out')"),
      ctx.db.prepare("INSERT INTO matches (id, player1_id, player2_id, league_id) VALUES ('m', 'org', 'mem', 'priv')"),
    ])
    as(user('out'))
    expect((await match.PATCH(req('PATCH', '/api/matches/m', { score_p1: 2, score_p2: 0 }), params({ id: 'm' }))).status).toBe(404)
    as(user('mem'))
    expect((await match.PATCH(req('PATCH', '/api/matches/m', { score_p1: 2, score_p2: 0 }), params({ id: 'm' }))).status).toBe(403)
    as(user('org'))
    expect((await match.PATCH(req('PATCH', '/api/matches/m', { score_p1: 2, score_p2: 0 }), params({ id: 'm' }))).status).toBe(200)
    expect((await match.DELETE(req('DELETE', '/api/matches/m'), params({ id: 'm' }))).status).toBe(200)
  })

  it('match introuvable : 404', async () => {
    as(user('org'))
    expect((await match.PATCH(req('PATCH', '/api/matches/nope', { score_p1: 2, score_p2: 0 }), params({ id: 'nope' }))).status).toBe(404)
  })

  it('playoffs : lecture d’une ligue publique par un visiteur, privée cachée', async () => {
    expect((await playoffs.GET(req('GET', '/api/leagues/pub/playoffs'), params({ id: 'pub' }))).status).toBe(200)
    expect((await playoffs.GET(req('GET', '/api/leagues/priv/playoffs'), params({ id: 'priv' }))).status).toBe(404)
  })
})
