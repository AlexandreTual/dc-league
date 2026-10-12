import { redirect } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth/session'
import { getFeaturedLeague } from '@/lib/db-leagues'
import { viewerOf } from './access'
import { legacyTarget, type LegacyPage } from './legacy'

/** Redirige une ancienne adresse vers la ligue mise en avant pour la personne qui consulte. */
export async function redirectLegacy(page: LegacyPage): Promise<never> {
  const db = getRequestContext<CloudflareEnv>().env.DB
  const { data } = await getFeaturedLeague(db, viewerOf(await getCurrentUser()))
  redirect(legacyTarget(page, data?.id ?? null))
}
