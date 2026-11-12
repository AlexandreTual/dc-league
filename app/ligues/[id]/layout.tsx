import Link from 'next/link'
import { ChevronLeft, Lock } from 'lucide-react'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { hasPlayoffs } from '@/lib/db'
import { loadVisibleLeague } from '@/lib/leagues/load'
import LeagueTabs from '@/components/LeagueTabs'
import LoadError from '@/components/LoadError'
import { organizerLabel, statusLabel } from '@/components/leagues/format'
import { getLang } from '@/lib/i18n/server'
import { messages } from '@/lib/i18n/messages'

export const runtime = 'edge'

/** Pages d'une ligue : en-tête (nom, organisateur, visibilité, état) et onglets. Ligue invisible : 404. */
export default async function LeagueLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params
  const [access, lang] = await Promise.all([loadVisibleLeague(id), getLang()])
  const t = messages(lang)
  if (!access) return <LoadError what={t.leagues.loadThisLeague} />
  const { league, canManage } = access
  // En cas d'erreur, pas d'onglet Playoffs : la page elle-même signale l'échec de chargement.
  const playoffs = await hasPlayoffs(getRequestContext<CloudflareEnv>().env.DB, id)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/ligues" className="inline-flex items-center gap-1 text-xs text-dc-muted hover:text-dc-gold">
          <ChevronLeft className="w-3.5 h-3.5" /> {t.leagues.allLeagues}
        </Link>
        <h1 data-user-content className="font-fantasy text-2xl md:text-3xl font-bold text-dc-gold">{league.name}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-dc-muted">
          <span>{organizerLabel(league, t)}</span>
          <span aria-hidden>·</span>
          <span>{statusLabel(league, t, lang)}</span>
          {league.visibility === 'private' && (
            <span className="inline-flex items-center gap-1 rounded-full border border-dc-border px-2 py-0.5 text-xs">
              <Lock className="w-3 h-3" /> {t.leagues.private}
            </span>
          )}
        </p>
      </div>
      <LeagueTabs leagueId={id} hasPlayoffs={playoffs.data ?? false} canManage={canManage} />
      {children}
    </div>
  )
}
