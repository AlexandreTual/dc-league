import { cookies } from 'next/headers'

const COOKIE_NAME = 'dc_admin_session'

function getExpectedToken(): string {
  const pwd = process.env.ADMIN_PASSWORD ?? ''
  return Buffer.from(`dc-admin:${pwd}`).toString('base64')
}

export function isAdminAuthenticated(): boolean {
  const cookieStore = cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  return token === getExpectedToken()
}

export function getAdminCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: getExpectedToken(),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  }
}

export { COOKIE_NAME }
