import { cookies } from 'next/headers'
import { getRequestContext } from '@cloudflare/next-on-pages'

const COOKIE_NAME = 'dc_admin_session'

function makeToken(pwd: string): string {
  return Buffer.from(`dc-admin:${pwd}`).toString('base64')
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const { env } = getRequestContext<CloudflareEnv>()
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  return token === makeToken(env.ADMIN_PASSWORD)
}

export function getAdminCookieOptions(pwd: string) {
  return {
    name: COOKIE_NAME,
    value: makeToken(pwd),
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  }
}

export { COOKIE_NAME }
