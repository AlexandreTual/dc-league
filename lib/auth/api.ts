import type { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from './session'
import { handleApi, type Access, type ApiContext } from './api-core'
import { getLang } from '@/lib/i18n/server'
import { localizeError } from '@/lib/i18n/errors'

export { badRequest, conflict, dbFailure, resultError, INTERNAL_ERROR, type ApiContext } from './api-core'

const deps = {
  getUser: () => getCurrentUser(),
  getEnv: () => getRequestContext<CloudflareEnv>().env,
  getLang,
}

/** Route API : origine, droits, corps JSON, erreurs dans la langue de la requête (voir handleApi). */
export function apiRoute(req: Request, access: Access, run: (ctx: ApiContext) => Promise<NextResponse>): Promise<NextResponse> {
  return handleApi(req, access, run, deps)
}

/**
 * Route écrite sans apiRoute : sa réponse d'erreur (`{ error }` en français) est traduite dans la langue de la requête.
 * `export const POST = localized(async function POST(req) { … })`
 */
export function localized<A extends unknown[], R extends Response>(handler: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R | NextResponse> => localizeError(await handler(...args), await getLang().catch(() => 'fr' as const))
}
