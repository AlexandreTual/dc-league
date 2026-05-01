import { computeLeaderboard } from '@/lib/leaderboard'
import { listPlayers, listCompletedMatches, countMatches } from '@/lib/db'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'
import LeaderboardTable from '@/components/LeaderboardTable'
import { Sword, Trophy } from 'lucide-react'

export const revalidate = 0

export default async function HomePage() {
  const { data: league } = getActiveLeague()
  const { data: players } = listPlayers()
  const { data: completedMatches } = league ? listCompletedMatches(league.id) : { data: [] }
  const { data: totalMatchCount } = league ? countMatches(league.id) : { data: 0 }
  const { data: leaguePlayers } = league ? listLeaguePlayers(league.id) : { data: [] }

  const enrolledIds = new Set((leaguePlayers ?? []).map((lp) => lp.player_id))
  const enrolledPlayers = (players ?? []).filter((p) => enrolledIds.has(p.id))
  const leaderboard = computeLeaderboard(enrolledPlayers, completedMatches ?? [])
  const deckMap = new Map((leaguePlayers ?? []).map((lp) => [lp.player_id, lp]))
  const leaderboardWithDecks = leaderboard.map((p) => {
    const lp = deckMap.get(p.id)
    return {
      ...p,
      deck_name: lp?.deck_name ?? null,
      moxfield_url: lp?.deck_moxfield_url ?? lp?.moxfield_url ?? null,
      commander_image_url: lp?.deck_commander_image_url ?? lp?.commander_image_url ?? null,
    }
  })

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Trophy className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-3xl md:text-4xl font-bold text-dc-gold">
          Commander League
        </h1>
        <p className="text-dc-muted text-sm">
          {league ? `${league.name} · ` : ''}Duel Commander · Round Robin · Top 4
        </p>

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

      {!league ? (
        <div className="text-center py-16 text-dc-muted">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Aucune saison active pour le moment.</p>
        </div>
      ) : (
        <LeaderboardTable
          players={leaderboardWithDecks}
          totalPlayers={enrolledPlayers.length}
        />
      )}
    </div>
  )
}
