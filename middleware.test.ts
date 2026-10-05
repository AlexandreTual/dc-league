import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { config, middleware } from './middleware'

const BASE = 'https://dc-league.example'

function request(path: string, token?: string) {
  const headers = new Headers()
  if (token) headers.set('cookie', `dc_session=${token}`)
  return new NextRequest(new URL(path, BASE), { headers })
}

describe('middleware', () => {
  it.each(['/admin', '/admin/login', '/profil', '/profil/decks'])('redirige %s vers /connexion sans session', (path) => {
    const res = middleware(request(path))
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location')!)
    expect(location.pathname).toBe('/connexion')
    expect(location.searchParams.get('from')).toBe(path)
  })

  it.each(['/', '/stats', '/history', '/history/l1', '/decks/d1', '/connexion', '/invitation/abc', '/salon', '/tables/t1'])(
    'laisse passer %s sans session ni cookie posé',
    (path) => {
      const res = middleware(request(path))
      expect(res.headers.get('location')).toBeNull()
      expect(res.cookies.get('dc_session')).toBeUndefined()
    },
  )

  it.each(['/', '/stats', '/salon', '/tables/t1', '/admin', '/profil'])('prolonge le cookie de session sur %s', (path) => {
    const res = middleware(request(path, 'jeton'))
    expect(res.headers.get('location')).toBeNull()
    const cookie = res.cookies.get('dc_session')
    expect(cookie?.value).toBe('jeton')
    expect(cookie?.maxAge).toBe(30 * 24 * 3600)
    expect(cookie?.httpOnly).toBe(true)
  })

  it("ne s'applique ni aux routes API ni aux fichiers statiques", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`)
    expect(matcher.test('/stats')).toBe(true)
    expect(matcher.test('/')).toBe(true)
    expect(matcher.test('/api/players')).toBe(false)
    expect(matcher.test('/_next/static/chunk.js')).toBe(false)
    expect(matcher.test('/favicon.ico')).toBe(false)
  })
})
