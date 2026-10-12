import { describe, it, expect } from 'vitest'
import { canViewLeague, canManageLeague, viewerOf } from './access'
import type { CurrentUser } from '@/lib/auth/types'

const pub = { visibility: 'public' as const, owner_player_id: 'org' }
const priv = { visibility: 'private' as const, owner_player_id: 'org' }
const joueur = { playerId: 'p', isAdmin: false }
const orga = { playerId: 'org', isAdmin: false }
const admin = { playerId: 'a', isAdmin: true }

const user = (u: Partial<CurrentUser>): CurrentUser => ({
  id: 'u', playerId: 'p', username: 'p', isAdmin: false, playerName: 'P', avatarUrl: null, isBootstrap: false, ...u,
})

describe('canViewLeague', () => {
  it('ligue publique : tout le monde, visiteurs compris', () => {
    expect(canViewLeague(pub, null, false)).toBe(true)
    expect(canViewLeague(pub, joueur, false)).toBe(true)
  })

  it('ligue privée : inscrits, organisateur et admin seulement', () => {
    expect(canViewLeague(priv, null, false)).toBe(false)
    expect(canViewLeague(priv, joueur, false)).toBe(false)
    expect(canViewLeague(priv, joueur, true)).toBe(true)
    expect(canViewLeague(priv, orga, false)).toBe(true)
    expect(canViewLeague(priv, admin, false)).toBe(true)
  })
})

describe('canManageLeague', () => {
  it('organisateur et admin', () => {
    expect(canManageLeague(pub, orga)).toBe(true)
    expect(canManageLeague(pub, admin)).toBe(true)
    expect(canManageLeague(pub, joueur)).toBe(false)
    expect(canManageLeague(pub, null)).toBe(false)
  })

  it('ligue sans organisateur : admin seulement', () => {
    expect(canManageLeague({ owner_player_id: null }, joueur)).toBe(false)
    expect(canManageLeague({ owner_player_id: null }, admin)).toBe(true)
  })
})

describe('viewerOf', () => {
  it('visiteur, joueur, admin, session de démarrage', () => {
    expect(viewerOf(null)).toBeNull()
    expect(viewerOf(user({}))).toEqual({ playerId: 'p', isAdmin: false })
    expect(viewerOf(user({ isAdmin: true }))).toEqual({ playerId: 'p', isAdmin: true })
    expect(viewerOf(user({ playerId: '', isBootstrap: true }))).toEqual({ playerId: '', isAdmin: true })
  })
})
