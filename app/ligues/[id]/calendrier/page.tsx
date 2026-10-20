import { getRequestContext } from '@cloudflare/next-on-pages'
import { listPlayers, listMatches } from '@/lib/db'
import { DbMatch, DbPlayer } from '@/lib/db'
import { loadVisibleLeague } from '@/lib/leagues/load'
import { Match, Player } from '@/lib/leaderboard'
import MatchCard from '@/components/MatchCard'
import { Calendar, CheckCircle, Clock } from 'lucide-react'
import LoadError from '@/components/LoadError'
import { getMessages } from '@/lib/i18n/server'

export const runtime = 'edge'
export const revalidate = 0

export default async function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const [access, t] = await Promise.all([loadVisibleLeague(id), getMessages()])
  const c = t.leagues.calendar
  if (!access) return <LoadError what={c.loadWhat} />

  const [{ data: players, error: playersError }, { data: matches, error: matchesError }] = await Promise.all([
    listPlayers(db),
    listMatches(db, id, true),
  ])

  if (playersError || matchesError) return <LoadError what={c.loadWhat} />

  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <Calendar className="w-12 h-12 text-dc-muted mx-auto opacity-40" />
        <p className="text-dc-muted">{c.notGenerated}</p>
        <p className="text-dc-muted text-sm">{c.organizerFirst}</p>
      </div>
    )
  }

  const playerMap: Record<string, DbPlayer> = {}
  for (const p of players ?? []) {
    playerMap[p.id] = p
  }

  const rounds: Record<number, DbMatch[]> = {}
  for (const match of matches) {
    const r = match.round_number
    if (!rounds[r]) rounds[r] = []
    rounds[r].push(match)
  }

  const completedCount = matches.filter((m) => m.is_completed).length
  const totalCount = matches.length

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Calendar className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h2 className="font-fantasy text-2xl font-bold text-dc-gold">{c.title}</h2>

        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-dc-green-light">
            <CheckCircle className="w-4 h-4" />
            {c.played(completedCount)}
          </span>
          <span className="text-dc-border">·</span>
          <span className="flex items-center gap-1.5 text-dc-muted">
            <Clock className="w-4 h-4" />
            {c.toPlay(totalCount - completedCount)}
          </span>
        </div>

        <div className="max-w-xs mx-auto h-1.5 bg-dc-border rounded-full overflow-hidden">
          <div
            className="h-full bg-dc-gold rounded-full transition-all"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(rounds)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([round, roundMatches]) => {
            const allDone = roundMatches.every((m) => m.is_completed)
            return (
              <div key={round}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      allDone
                        ? 'bg-dc-green/40 border-dc-green-light/30 text-dc-green-light'
                        : 'bg-dc-surface border-dc-border text-dc-muted'
                    }`}
                  >
                    {c.round} {round}
                  </div>
                  <div className="flex-1 h-px bg-dc-border/50" />
                </div>

                <div className="space-y-2">
                  {roundMatches.map((match) => {
                    const p1 = playerMap[match.player1_id]
                    const p2 = playerMap[match.player2_id]
                    if (!p1 || !p2) return null
                    return (
                      <MatchCard
                        key={match.id}
                        match={{ ...(match as unknown as Match), player1: p1 as unknown as Player, player2: p2 as unknown as Player }}
                        isAdmin={false}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
