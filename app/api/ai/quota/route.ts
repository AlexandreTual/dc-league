import { NextRequest, NextResponse } from 'next/server'
import { apiRoute } from '@/lib/auth/api'
import { remainingQuestions } from '@/lib/ai/ask'
import { aiAvailable } from '@/lib/ai/server'

export const runtime = 'edge'

/** Assistant IA disponible ? Questions restantes aujourd'hui pour le joueur connecté. */
export function GET(req: NextRequest) {
  return apiRoute(req, 'user', async ({ db, env, user }) =>
    NextResponse.json({ enabled: await aiAvailable(env), remaining: await remainingQuestions(db, user!.id, new Date()) }),
  )
}
