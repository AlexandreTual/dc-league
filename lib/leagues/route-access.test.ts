import { describe, it, expect, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { createTestDb } from '@/test/d1'
import type { CurrentUser } from '@/lib/auth/types'
import { leagueFor, MANAGE_REFUSED } from './route-access'

let db: D1Database
const user = (playerId: string, isAdmin = false): CurrentUser => ({
  id: `u-${playerId}`, playerId, username: playerId, isAdmin, playerName: playerId, avatarUrl: null, isBootstrap: false,
})

beforeEach(async () => {
  db = createTestDb()
  await db.batch([
    db.prepare("INSERT INTO players (id, name) VALUES ('org', 'Orga'), ('mem', 'Membre'), ('out', 'Dehors'), ('adm', 'Admin')"),
    db.prepare("INSERT INTO leagues (id, name, owner_player_id, visibility) VALUES ('priv', 'Privée', 'org', 'private')"),
    db.prepare("INSERT INTO league_players (league_id, player_id) VALUES ('priv', 'mem')"),
  ])
})

const status = async (r: unknown) => (r instanceof NextResponse ? [r.status, ((await r.json()) as { error: string }).error] : 'ok')

describe('leagueFor', () => {
  it('ligue absente : 404', async () => {
    expect(await status(await leagueFor(db, 'nope', user('org'), 'view'))).toEqual([404, 'Ligue introuvable.'])
  })

  it('ligue privée vue par un non-membre ou un visiteur : 404', async () => {
    expect(await status(await leagueFor(db, 'priv', user('out'), 'view'))).toEqual([404, 'Ligue introuvable.'])
    expect(await status(await leagueFor(db, 'priv', null, 'view'))).toEqual([404, 'Ligue introuvable.'])
    expect(await status(await leagueFor(db, 'priv', user('out'), 'manage'))).toEqual([404, 'Ligue introuvable.'])
  })

  it('membre : voit mais ne gère pas', async () => {
    const r = await leagueFor(db, 'priv', user('mem'), 'view')
    expect(r).toMatchObject({ isMember: true, canManage: false })
    expect(await status(await leagueFor(db, 'priv', user('mem'), 'manage'))).toEqual([403, MANAGE_REFUSED])
  })

  it('organisateur et admin gèrent', async () => {
    expect(await leagueFor(db, 'priv', user('org'), 'manage')).toMatchObject({ canManage: true, league: { id: 'priv' } })
    expect(await leagueFor(db, 'priv', user('adm', true), 'manage')).toMatchObject({ canManage: true })
  })
})
