import { NextResponse } from 'next/server'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { assertSameOrigin, requirePlayer } from '@/lib/auth'
import type { CurrentUser } from '@/lib/auth/types'
import type { Result } from '@/lib/db'
import { INTERNAL_ERROR } from './start'

const STATUS: Record<string, number> = {
  'Table introuvable': 404,
  "Seul l'hôte peut faire ça": 403,
  [INTERNAL_ERROR]: 500,
}

/** Réponse JSON d'un résultat : erreurs métier en 400 (403 / 404 / 500 selon le message). */
export function resultResponse<T>(result: Result<T>): NextResponse {
  if (result.error !== null) {
    return NextResponse.json({ error: result.error }, { status: STATUS[result.error] ?? 400 })
  }
  return NextResponse.json(result.data)
}

export type GameRequestContext = { db: D1Database; env: CloudflareEnv; user: CurrentUser; body: Record<string, unknown> }

/** Route d'écriture du salon : même origine, joueur connecté, corps JSON (objet) facultatif. */
export async function gameWrite(req: Request, run: (ctx: GameRequestContext) => Promise<NextResponse>): Promise<NextResponse> {
  const forbidden = assertSameOrigin(req)
  if (forbidden) return forbidden
  const user = await requirePlayer()
  if (user instanceof NextResponse) return user
  const parsed = await req.json().catch(() => ({}))
  const body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  const { env } = getRequestContext<CloudflareEnv>()
  return run({ db: env.DB, env, user, body })
}
