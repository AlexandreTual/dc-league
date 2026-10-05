import type { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from './session'
import { handleApi, type Access, type ApiContext } from './api-core'

export { badRequest, conflict, dbFailure, resultError, INTERNAL_ERROR, type ApiContext } from './api-core'

const deps = {
  getUser: () => getCurrentUser(),
  getEnv: () => getRequestContext<CloudflareEnv>().env,
}

/** Route API : origine, droits, corps JSON, erreurs en français (voir handleApi). */
export function apiRoute(req: Request, access: Access, run: (ctx: ApiContext) => Promise<NextResponse>): Promise<NextResponse> {
  return handleApi(req, access, run, deps)
}
