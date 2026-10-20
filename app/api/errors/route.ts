import { NextRequest, NextResponse } from 'next/server'
import { apiRoute, badRequest } from '@/lib/auth/api'
import { clientErrorEntry } from '@/lib/client-error'
import { recordError } from '@/lib/db-errors'

export const runtime = 'edge'

/**
 * Erreur affichée par une page d'erreur du navigateur, ajoutée au journal de l'administration.
 * Ouvert aux visiteurs (une page peut planter avant la connexion) ; le journal est borné.
 */
export async function POST(req: NextRequest) {
  return apiRoute(req, 'viewer', async ({ db, body, user }) => {
    const entry = clientErrorEntry(body, user?.id ?? null)
    if (!entry) return badRequest('Requête invalide')
    const { error } = await recordError(db, entry, new Date())
    // Journal indisponible (base pas encore migrée…) : rien de plus à faire pour le navigateur.
    if (error !== null) console.error('[erreurs]', error)
    return NextResponse.json({ ok: true })
  })
}
