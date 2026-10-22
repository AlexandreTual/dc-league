import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Doit rester aligné avec lib/auth/session.ts (le middleware n'importe pas ce module serveur).
const SESSION_COOKIE = 'dc_session'
const SESSION_MAX_AGE = 30 * 24 * 3600

/** Seules ces pages exigent une connexion ; les autres restent publiques. */
const PROTECTED = ['/admin', '/profil']

function isProtected(pathname: string): boolean {
  return PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * CSP imposée : uniquement ce qui ne peut rien casser (pas d'intégration dans un cadre étranger,
 * pas de plugin, pas de <base> détournée). Scripts, styles, images et connexions ne sont pas restreints ici.
 */
export const CSP = ["frame-ancestors 'self'", "object-src 'none'", "base-uri 'self'"].join('; ')

/**
 * CSP restreinte, en observation seulement (Content-Security-Policy-Report-Only) : le navigateur signale
 * dans sa console ce qu'elle bloquerait, sans rien bloquer. Elle deviendra imposée quand les relevés seront propres.
 * - scripts et styles en ligne : nécessaires à Next (hydratation) et aux attributs style ;
 * - images : Scryfall (cartes, jetons) et Moxfield (images de commandant), plus data:/blob: ;
 * - connexions : le site seul (API, WebSocket du serveur de jeu relayée par /api/games/…/ws).
 */
export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.scryfall.io https://*.scryfall.com https://*.moxfield.com https://*.moxfield.net",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': CSP,
  'Content-Security-Policy-Report-Only': CSP_REPORT_ONLY,
}

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value)
  return response
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    if (!isProtected(request.nextUrl.pathname)) return withSecurityHeaders(NextResponse.next())
    const loginUrl = new URL('/connexion', request.url)
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
    return withSecurityHeaders(NextResponse.redirect(loginUrl))
  }

  // La session est prolongée en base : on prolonge aussi le cookie, sur toutes les pages.
  // La vraie vérification se fait côté serveur.
  const response = withSecurityHeaders(NextResponse.next())
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}

export const config = {
  // Toutes les pages, sauf les routes API et les fichiers statiques.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
