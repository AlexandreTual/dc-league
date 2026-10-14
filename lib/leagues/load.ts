// Chargement d'une ligue dans une page serveur : 404 si elle est invisible pour la personne qui consulte.
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth/session'
import { resolveLeagueAccess, type LeagueAccess } from './route-access'

/** Une seule résolution par requête (partagée par la mise en page et la page). null si la base échoue. */
export const loadVisibleLeague = cache(async (id: string): Promise<LeagueAccess | null> => {
  const db = getRequestContext<CloudflareEnv>().env.DB
  const access = await resolveLeagueAccess(db, id, await getCurrentUser())
  if (access === 'not-found') notFound()
  if ('error' in access) {
    console.error('[ligue]', access.error)
    return null
  }
  return access
})
