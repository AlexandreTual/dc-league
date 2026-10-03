import { cache } from 'react'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { hashToken } from './crypto'
import { resolveSession, SESSION_TTL_MS } from './resolve'
import type { CurrentUser } from './types'

export { assertSameOrigin } from './origin'

export const SESSION_COOKIE = 'dc_session'

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

/** Utilisateur courant (une seule résolution par requête). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const { env } = getRequestContext<CloudflareEnv>()
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return resolveSession(env.DB, token, new Date())
})

export async function currentSessionIdHash(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return token ? hashToken(token) : null
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date): void {
  const maxAge = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
  res.cookies.set({ name: SESSION_COOKIE, value: token, ...sessionCookieOptions(maxAge) })
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set({ name: SESSION_COOKIE, value: '', ...sessionCookieOptions(0) })
}

export const SESSION_COOKIE_MAX_AGE = Math.floor(SESSION_TTL_MS / 1000)

export async function requireUser(): Promise<CurrentUser | NextResponse> {
  const user = await getCurrentUser()
  return user ?? NextResponse.json({ error: 'Connexion requise' }, { status: 401 })
}

/** Connecté avec un vrai compte joueur (pas la session de démarrage). */
export async function requirePlayer(): Promise<CurrentUser | NextResponse> {
  const user = await requireUser()
  if (user instanceof NextResponse) return user
  if (user.isBootstrap) {
    return NextResponse.json({ error: 'Crée ton compte avant de modifier un profil' }, { status: 403 })
  }
  return user
}

export async function requireAdmin(): Promise<CurrentUser | NextResponse> {
  const user = await requireUser()
  if (user instanceof NextResponse) return user
  if (!user.isAdmin) return NextResponse.json({ error: 'Accès réservé aux admins' }, { status: 403 })
  return user
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return !!user && (user.isAdmin || user.isBootstrap)
}
