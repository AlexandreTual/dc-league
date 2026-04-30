import { listPlayers, listMatches } from '@/lib/db'
import { DbMatch, DbPlayer } from '@/lib/db'
import { getActiveLeague } from '@/lib/db-leagues'
import { Match, Player } from '@/lib/leaderboard'
import MatchCard from '@/components/MatchCard'
import { Calendar, CheckCircle, Clock } from 'lucide-react'

export const revalidate = 0

export default async function CalendarPage() {
  const { data: players } = listPlayers()
  const { data: activeLeague } = getActiveLeague()
  const { data: matches } = activeLeague ? listMatches(activeLeague.id, true) : { data: [] }

  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <Calendar className="w-12 h-12 text-dc-muted mx-auto opacity-40" />
        <p className="text-dc-muted">La ligue n&apos;a pas encore été générée.</p>
        <p className="text-dc-muted text-sm">
          L&apos;admin doit d&apos;abord ajouter les joueurs et générer les matchs.
        </p>
      </div>
    )
  }

  // Build player lookup
  const playerMap: Record<string, DbPlayer> = {}
  for (const p of players ?? []) {
    playerMap[p.id] = p
  }

  // Group by round
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
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Calendar className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-3xl font-bold text-dc-gold">Calendrier</h1>

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

        {/* Progress bar */}
        <div className="max-w-xs mx-auto h-1.5 bg-dc-border rounded-full overflow-hidden">
          <div
            className="h-full bg-dc-gold rounded-full transition-all"
            style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Rounds */}
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
                    Round {round}
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
