import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest } from '@/lib/auth/api'
import { askAi, parseAskBody } from '@/lib/ai/ask'
import { askDeps } from '@/lib/ai/server'

export const runtime = 'edge'

/** Question à l'assistant IA sur des cartes déjà importées (joueurs connectés, 20 par jour). */
export function POST(req: NextRequest) {
  return apiRoute(req, 'user', async ({ env, user, body }) => {
    const parsed = parseAskBody(body)
    if (!parsed.ok) return badRequest(parsed.error)
    const { status, ...result } = await askAi(askDeps(env, new Date()), user!.id, parsed.oracleIds, parsed.messages)
    return NextResponse.json(result, { status })
  })
}
