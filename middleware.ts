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

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    if (!isProtected(request.nextUrl.pathname)) return NextResponse.next()
    const loginUrl = new URL('/connexion', request.url)
    loginUrl.searchParams.set('from', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  // La session est prolongée en base : on prolonge aussi le cookie, sur toutes les pages.
  // La vraie vérification se fait côté serveur.
  const response = NextResponse.next()
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
