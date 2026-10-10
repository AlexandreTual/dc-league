import { getRequestContext } from '@cloudflare/next-on-pages'
import { listPlayoffs } from '@/lib/db'
import { getActiveLeague } from '@/lib/db-leagues'
import LeagueTabs from '@/components/LeagueTabs'

export const runtime = 'edge'

/** Pages de la ligue (classement, calendrier, playoffs, statistiques, historique) sous une même rangée d'onglets. */
export default async function LeagueLayout({ children }: { children: React.ReactNode }) {
  const db = getRequestContext<CloudflareEnv>().env.DB
  // En cas d'erreur, pas d'onglet Playoffs : la page elle-même signale l'échec de chargement.
  const { data: league } = await getActiveLeague(db)
  const { data: playoffs } = league ? await listPlayoffs(db, league.id) : { data: [] }
  return (
    <div className="space-y-6">
      <LeagueTabs hasPlayoffs={(playoffs ?? []).length > 0} />
      {children}
    </div>
  )
}
