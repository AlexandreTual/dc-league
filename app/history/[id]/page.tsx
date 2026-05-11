import { getRequestContext } from '@cloudflare/next-on-pages'
import { notFound } from 'next/navigation'
import { getLeagueDetail } from '@/lib/db-leagues'
import { listPlayers } from '@/lib/db'
import { computeLeaderboard } from '@/lib/leaderboard'
import LeaderboardTable from '@/components/LeaderboardTable'
import MatchCard from '@/components/MatchCard'
import { Clock, Trophy, Award } from 'lucide-react'
import type { Player, Match } from '@/lib/leaderboard'

export const runtime = 'edge'
export const revalidate = 0

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

const stageLabels: Record<string, string> = {
  semi1: 'Demi-finale 1 · 1er vs 4ème',
  semi2: 'Demi-finale 2 · 2ème vs 3ème',
  final: 'Grande Finale',
  third_place: 'Petite Finale · 3ème place',
}

export default async function HistoryDetailPage({ params }: { params: { id: string } }) {
  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const [{ data: detail }, { data: allPlayers }] = await Promise.all([
    getLeagueDetail(db, params.id),
    listPlayers(db),
  ])

  if (!detail) notFound()

  const { league, leaguePlayers, matches, playoffs } = detail

  const participantIds = new Set(leaguePlayers.map((lp) => lp.player_id))
  const participants = (allPlayers ?? []).filter((p) => participantIds.has(p.id))

  const deckMap = new Map(leaguePlayers.map((lp) => [lp.player_id, lp]))

  const leaderboard = computeLeaderboard(participants as Player[], matches as Match[])
  const leaderboardWithDecks = leaderboard.map((p) => {
    const lp = deckMap.get(p.id)
    return {
      ...p,
      moxfield_url: lp?.deck_moxfield_url ?? lp?.moxfield_url ?? null,
      commander_image_url: lp?.deck_commander_image_url ?? lp?.commander_image_url ?? null,
    }
  })

  const playerMap: Record<string, Player> = {}
  for (const p of participants) {
    const lp = deckMap.get(p.id)
    playerMap[p.id] = {
      ...(p as Player),
      moxfield_url: lp?.deck_moxfield_url ?? lp?.moxfield_url ?? null,
      commander_image_url: lp?.deck_commander_image_url ?? lp?.commander_image_url ?? null,
    }
  }

  const rounds: Record<number, typeof matches> = {}
  for (const m of matches) {
    if (!rounds[m.round_number]) rounds[m.round_number] = []
    rounds[m.round_number].push(m)
  }

  return (
    <div className="space-y-10">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <div className="gold-divider w-16" />
          <Trophy className="w-6 h-6 text-dc-gold" />
          <div className="gold-divider w-16" />
        </div>
        <h1 className="font-fantasy text-3xl font-bold text-dc-gold">{league.name}</h1>
        <p className="text-dc-muted text-sm flex items-center justify-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {formatDate(league.started_at)}
          {league.ended_at && ` → ${formatDate(league.ended_at)}`}
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-fantasy font-bold text-dc-text text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-dc-gold" /> Classement final
        </h2>
        <LeaderboardTable players={leaderboardWithDecks} totalPlayers={participants.length} />
      </section>

      {playoffs.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-fantasy font-bold text-dc-gold text-lg flex items-center gap-2">
            <Award className="w-5 h-5" /> Playoffs
          </h2>
          <div className="space-y-3">
            {playoffs.map((po) => {
              const p1 = po.player1_id ? playerMap[po.player1_id] : null
              const p2 = po.player2_id ? playerMap[po.player2_id] : null
              if (!p1 || !p2) return null
              return (
                <div key={po.id}>
                  <MatchCard
                    match={{
                      id: po.id,
                      player1_id: po.player1_id!,
                      player2_id: po.player2_id!,
                      score_p1: po.score_p1,
                      score_p2: po.score_p2,
                      is_completed: po.is_completed,
                      round_number: 0,
                      player1: p1,
                      player2: p2,
                    }}
                  />
                  <p className={`text-xs mt-1 ml-1 ${po.stage === 'final' ? 'text-dc-gold/70' : 'text-dc-muted'}`}>
                    {stageLabels[po.stage]}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="space-y-6">
        <h2 className="font-fantasy font-bold text-dc-text text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-dc-gold" /> Matchs Round Robin
        </h2>
        {Object.entries(rounds)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([round, roundMatches]) => (
            <div key={round}>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-xs font-bold px-3 py-1 rounded-full border bg-dc-surface border-dc-border text-dc-muted">
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
                      match={{ ...match, player1: p1, player2: p2 } as Match & { player1: Player; player2: Player }}
                    />
                  )
                })}
              </div>
            </div>
          ))}
      </section>
    </div>
  )
}
