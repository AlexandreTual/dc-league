import { getRequestContext } from '@cloudflare/next-on-pages'
import { listPlayers, listMatches, listEnrolledPlayers } from '@/lib/db'
import { DbMatch, DbPlayer } from '@/lib/db'
import { loadVisibleLeague } from '@/lib/leagues/load'
import { Match, Player } from '@/lib/leaderboard'
import { byesByRound } from '@/lib/leagues/byes'
import { calendarFor, isMyMatch } from '@/lib/leagues/my-matches'
import Link from 'next/link'
import MatchCard from '@/components/MatchCard'
import { Calendar, CheckCircle, Clock } from 'lucide-react'
import LoadError from '@/components/LoadError'

export const runtime = 'edge'
export const revalidate = 0

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ vue?: string }>
}) {
  const { id } = await params
  const { vue } = await searchParams
  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const access = await loadVisibleLeague(id)
  if (!access) return <LoadError what="le calendrier" />

  const [
    { data: players, error: playersError },
    { data: matches, error: matchesError },
    { data: enrolled, error: enrolledError },
  ] = await Promise.all([listPlayers(db), listMatches(db, id, true), listEnrolledPlayers(db, id)])

  if (playersError || matchesError || enrolledError) return <LoadError what="le calendrier" />

  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <Calendar className="w-12 h-12 text-dc-muted mx-auto opacity-40" />
        <p className="text-dc-muted">La ligue n&apos;a pas encore été générée.</p>
        <p className="text-dc-muted text-sm">
          L&apos;organisateur doit d&apos;abord inscrire les joueurs et générer les matchs.
        </p>
      </div>
    )
  }

  const playerMap: Record<string, DbPlayer> = {}
  for (const p of players ?? []) {
    playerMap[p.id] = p
  }

  const me = access.viewer?.playerId ?? null
  const calendar = calendarFor(matches, me, vue === 'mes')
  const opponents = calendar.remainingOpponents.map((pid) => playerMap[pid]?.name).filter(Boolean)

  const rounds: Record<number, DbMatch[]> = {}
  for (const match of calendar.shown) {
    const r = match.round_number
    if (!rounds[r]) rounds[r] = []
    rounds[r].push(match)
  }

  const byes = byesByRound((enrolled ?? []).map((p) => p.id), matches)
  // En « Mes matchs », une ronde où je suis exempt reste affichée (avec sa ligne « Exempt »).
  if (calendar.mineOnly && me) {
    for (const [round, ids] of byes) if (ids.includes(me) && !rounds[round]) rounds[round] = []
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
        <h2 className="font-fantasy text-2xl font-bold text-dc-gold">Calendrier</h2>

        <div className="flex items-center justify-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-dc-green-light">
            <CheckCircle className="w-4 h-4" />
            {completedCount} joués
          </span>
          <span className="text-dc-border">·</span>
          <span className="flex items-center gap-1.5 text-dc-muted">
            <Clock className="w-4 h-4" />
            {totalCount - completedCount} à jouer
          </span>
        </div>

        <div className="max-w-xs mx-auto h-1.5 bg-dc-border rounded-full overflow-hidden">
          <div
            className="h-full bg-dc-gold rounded-full transition-all"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>

        {calendar.showToggle && (
          <div className="space-y-3 pt-1">
            {opponents.length > 0 && (
              <p className="text-sm text-dc-text" data-testid="my-remaining">
                Il te reste {opponents.length} {opponents.length > 1 ? 'matchs' : 'match'} : contre{' '}
                <span className="text-dc-gold">{opponents.join(', ')}</span>
              </p>
            )}
            <div className="inline-flex rounded-full border border-dc-border p-0.5 text-sm" data-testid="my-matches-toggle">
              {[
                { label: 'Mes matchs', href: `/ligues/${id}/calendrier?vue=mes`, active: calendar.mineOnly },
                { label: 'Tous', href: `/ligues/${id}/calendrier`, active: !calendar.mineOnly },
              ].map((t) => (
                <Link
                  key={t.label}
                  href={t.href}
                  scroll={false}
                  aria-current={t.active ? 'page' : undefined}
                  className={`min-h-[44px] inline-flex items-center px-4 rounded-full ${
                    t.active ? 'bg-dc-gold text-dc-bg font-semibold' : 'text-dc-muted hover:text-dc-gold'
                  }`}
                >
                  {t.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {Object.entries(rounds)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([round, roundMatches]) => {
            const allDone = matches.filter((m) => m.round_number === Number(round)).every((m) => m.is_completed)
            const exempt = (byes.get(Number(round)) ?? []).map((pid) => playerMap[pid]?.name).filter(Boolean)
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
                    Ronde {round}
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
                        mine={isMyMatch(match, me)}
                      />
                    )
                  })}
                </div>

                {exempt.length > 0 && (
                  <p className="mt-2 text-sm text-dc-muted" data-testid="round-bye">
                    {exempt.length > 1 ? 'Exempts' : 'Exempt'} : <span className="text-dc-text">{exempt.join(', ')}</span>
                  </p>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
