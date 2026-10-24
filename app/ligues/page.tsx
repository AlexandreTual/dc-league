import Link from 'next/link'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { BarChart2, Plus, Trophy } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth/session'
import { listLeaguesFor, listMyLeagueIds, type DbLeague } from '@/lib/db-leagues'
import { viewerOf } from '@/lib/leagues/access'
import { groupLeagues } from '@/lib/leagues/list'
import LeagueCard from '@/components/leagues/LeagueCard'
import LoadError from '@/components/LoadError'
import { getMessages } from '@/lib/i18n/server'

export const runtime = 'edge'
export const revalidate = 0

function Section({ title, leagues, empty }: { title: string; leagues: DbLeague[]; empty?: string }) {
  if (leagues.length === 0 && !empty) return null
  return (
    <section className="space-y-3">
      <h2 className="font-fantasy text-lg font-semibold text-dc-gold">{title}</h2>
      {leagues.length === 0 ? (
        <p className="text-dc-muted text-sm">{empty}</p>
      ) : (
        <div className="space-y-2">{leagues.map((l) => <LeagueCard key={l.id} league={l} />)}</div>
      )}
    </section>
  )
}

/** Toutes les ligues visibles : les miennes, les autres en cours, les terminées. */
export default async function LeaguesPage() {
  const db = getRequestContext<CloudflareEnv>().env.DB
  const [user, t] = await Promise.all([getCurrentUser(), getMessages()])
  const l = t.leagues.list
  const isPlayer = !!user && !user.isBootstrap
  const [leagues, mine] = await Promise.all([
    listLeaguesFor(db, viewerOf(user)),
    isPlayer ? listMyLeagueIds(db, user.playerId) : Promise.resolve({ data: [] as string[], error: null }),
  ])
  if (leagues.error !== null || mine.error !== null) return <LoadError what={l.loadWhat} />
  const groups = groupLeagues(leagues.data, new Set(mine.data))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-fantasy text-3xl font-bold text-dc-gold inline-flex items-center gap-2">
          <Trophy className="w-6 h-6" /> {l.title}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/ligues/statistiques" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dc-gold/40 text-dc-gold text-sm hover:bg-dc-gold/10">
            <BarChart2 className="w-4 h-4" /> {l.stats}
          </Link>
          {isPlayer && (
            <Link href="/ligues/nouvelle" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-dc-gold text-dc-bg text-sm font-semibold hover:bg-dc-gold-light">
              <Plus className="w-4 h-4" /> {l.create}
            </Link>
          )}
        </div>
      </div>

      {isPlayer && (
        <Section title={l.mine} leagues={groups.mine} empty={l.mineEmpty} />
      )}
      <Section
        title={isPlayer ? l.others : l.ongoing}
        leagues={groups.others}
        empty={isPlayer ? undefined : l.ongoingEmpty}
      />
      <Section title={l.finished} leagues={groups.finished} />
    </div>
  )
}
