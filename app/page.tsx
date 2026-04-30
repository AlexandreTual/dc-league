import { computeLeaderboard } from '@/lib/leaderboard'
import { listPlayers, listCompletedMatches, countMatches } from '@/lib/db'
import LeaderboardTable from '@/components/LeaderboardTable'
import { Sword, Trophy } from 'lucide-react'

export const revalidate = 0

export default async function HomePage() {
  const { data: players } = listPlayers()
  const { data: completedMatches } = listCompletedMatches()
  const { data: totalMatchCount } = countMatches()

  const leaderboard = computeLeaderboard(players ?? [], completedMatches ?? [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Trophy className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-3xl md:text-4xl font-bold text-dc-gold">
          Commander League
        </h1>
        <p className="text-dc-muted text-sm">Duel Commander · Round Robin · Top 4</p>

        {/* Progress */}
        {(totalMatchCount ?? 0) > 0 && (
          <div className="inline-flex items-center gap-2 bg-dc-surface border border-dc-border rounded-full px-4 py-1.5 text-sm">
            <Sword className="w-3.5 h-3.5 text-dc-gold" />
            <span className="text-dc-muted">
              <span className="text-dc-text font-semibold">{completedMatches?.length ?? 0}</span>
              {' '}/ {totalMatchCount} matchs joués
            </span>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <LeaderboardTable
        players={leaderboard}
        totalPlayers={players?.length ?? 0}
      />
    </div>
  )
}
