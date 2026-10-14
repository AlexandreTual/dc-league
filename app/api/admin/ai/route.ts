import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest, dbFailure } from '@/lib/auth/api'
import { aiAdminStatus } from '@/lib/ai/admin'
import { setAiSwitch } from '@/lib/ai/switch'

export const runtime = 'edge'

/** Assistant IA : interrupteur, présence de la clé, utilisation du jour (admins). */
export function GET(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ env }) => NextResponse.json(await aiAdminStatus(env, new Date())))
}

/** Active ou désactive l'assistant IA, sans redéployer. */
export function PATCH(req: NextRequest) {
  return apiRoute(req, 'admin', async ({ db, env, body }) => {
    if (typeof body.enabled !== 'boolean') return badRequest('Requête invalide')
    const saved = await setAiSwitch(db, body.enabled, new Date())
    if (saved.error !== null) return dbFailure(saved.error)
    return NextResponse.json(await aiAdminStatus(env, new Date()))
  })
}
