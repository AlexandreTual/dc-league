import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const COOKIE_NAME = 'dc_admin_session'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect /admin/* but allow /admin/login
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminPassword = process.env.ADMIN_PASSWORD ?? ''
    const expectedToken = Buffer.from(`dc-admin:${adminPassword}`).toString('base64')
    const sessionCookie = request.cookies.get(COOKIE_NAME)?.value

    if (sessionCookie !== expectedToken) {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
