import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { config, CSP_REPORT_ONLY, middleware } from './middleware'

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

  describe('en-têtes de sécurité', () => {
    it.each([
      ['page publique sans session', '/', undefined],
      ['page publique avec session', '/stats', 'jeton'],
      ['redirection vers /connexion', '/admin', undefined],
      ['page protégée avec session', '/profil', 'jeton'],
    ])('les pose sur une %s', (_cas, path, token) => {
      const res = middleware(request(path, token))
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
      expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
      const csp = res.headers.get('content-security-policy')
      expect(csp).toContain("frame-ancestors 'self'")
      expect(csp).toContain("object-src 'none'")
      expect(csp).toContain("base-uri 'self'")
      expect(res.headers.get('content-security-policy-report-only')).toBe(CSP_REPORT_ONLY)
    })

    it('la CSP imposée ne restreint ni scripts, ni styles, ni images, ni connexions', () => {
      const csp = middleware(request('/')).headers.get('content-security-policy')!
      for (const directive of ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src']) {
        expect(csp).not.toContain(directive)
      }
    })

    it("la CSP en observation limite les images à Scryfall et Moxfield et les connexions au site (serveur de jeu compris)", () => {
      const directives = Object.fromEntries(
        CSP_REPORT_ONLY.split(';').map((d) => d.trim().split(/\s+/)).map(([name, ...values]) => [name, values]),
      )
      expect(directives['default-src']).toEqual(["'self'"])
      expect(directives['img-src']).toEqual(
        expect.arrayContaining(["'self'", 'https://*.scryfall.io', 'https://*.moxfield.com', 'https://*.moxfield.net']),
      )
      expect(directives['img-src']).not.toContain('https:')
      expect(directives['connect-src']).toEqual(["'self'"])
      expect(directives['object-src']).toEqual(["'none'"])
      expect(directives['frame-ancestors']).toEqual(["'self'"])
    })
  })
})
