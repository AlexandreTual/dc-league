import { getRequestContext } from '@cloudflare/next-on-pages'
import { computeLeaderboard } from '@/lib/leaderboard'
import { listPlayers, listCompletedMatches, countMatches } from '@/lib/db'
import { listLeaguePlayers } from '@/lib/db-leagues'
import { loadVisibleLeague } from '@/lib/leagues/load'
import LeaderboardTable from '@/components/LeaderboardTable'
import LoadError from '@/components/LoadError'
import { loadFailed } from '@/lib/load'
import { Sword, Trophy } from 'lucide-react'

export const runtime = 'edge'
export const revalidate = 0

export default async function ClassementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const access = await loadVisibleLeague(id)
  if (!access) return <LoadError what="le classement" />

  const [playersRes, completedRes, countRes, leaguePlayersRes] = await Promise.all([
    listPlayers(db),
    listCompletedMatches(db, id),
    countMatches(db, id),
    listLeaguePlayers(db, id),
  ])
  const players = playersRes.data
  if (loadFailed(playersRes, completedRes, countRes, leaguePlayersRes)) {
    return <LoadError what="le classement" />
  }
  const completedMatches = completedRes.data
  const totalMatchCount = countRes.data
  const leaguePlayers = leaguePlayersRes.data

  const enrolledIds = new Set((leaguePlayers ?? []).map((lp) => lp.player_id))
  const enrolledPlayers = (players ?? []).filter((p) => enrolledIds.has(p.id))
  const leaderboard = computeLeaderboard(enrolledPlayers, completedMatches ?? [])
  const deckMap = new Map((leaguePlayers ?? []).map((lp) => [lp.player_id, lp]))
  const leaderboardWithDecks = leaderboard.map((p) => {
    const lp = deckMap.get(p.id)
    return {
      ...p,
      deck_name: lp?.deck_name ?? null,
      deck_url: lp?.deck_has_cards ? `/decks/${lp.deck_id}` : null,
      moxfield_url: lp?.deck_moxfield_url ?? lp?.moxfield_url ?? null,
      commander_image_url: lp?.deck_commander_image_url ?? lp?.commander_image_url ?? null,
    }
  })

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <p className="text-dc-muted text-sm">Duel Commander · Round Robin · Top 4</p>

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

      {(totalMatchCount ?? 0) === 0 ? (
        <div className="text-center py-16 text-dc-muted">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>La ligue n&apos;a pas encore démarré.</p>
          <p className="text-sm mt-1">{enrolledPlayers.length} joueur{enrolledPlayers.length > 1 ? 's' : ''} inscrit{enrolledPlayers.length > 1 ? 's' : ''}.</p>
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
