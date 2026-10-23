import { getRequestContext } from '@cloudflare/next-on-pages'
import { countMatches } from '@/lib/db'
import { loadStandings } from '@/lib/standings'
import { listLeaguePlayers } from '@/lib/db-leagues'
import { loadVisibleLeague } from '@/lib/leagues/load'
import { listPlayerDecks } from '@/lib/db-decks'
import MyEntry from '@/components/leagues/MyEntry'
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

  const me = access.isMember && access.viewer ? access.viewer.playerId : null
  const [standingsRes, countRes, leaguePlayersRes, myDecksRes] = await Promise.all([
    loadStandings(db, id),
    countMatches(db, id),
    listLeaguePlayers(db, id),
    me ? listPlayerDecks(db, me) : Promise.resolve({ data: [], error: null }),
  ])
  if (loadFailed(standingsRes, countRes, leaguePlayersRes, myDecksRes)) {
    return <LoadError what="le classement" />
  }
  const { standings: leaderboard, played } = standingsRes.data!
  const totalMatchCount = countRes.data
  const leaguePlayers = leaguePlayersRes.data

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

  const myEntry = me ? (leaguePlayers ?? []).find((lp) => lp.player_id === me) : undefined

  return (
    <div className="space-y-8">
      {me && myEntry && access.league.is_active && (
        <MyEntry
          leagueId={id}
          playerId={me}
          decks={(myDecksRes.data ?? []).map((d) => ({ id: d.id, name: d.name }))}
          deckId={myEntry.deck_id}
          canLeave={(totalMatchCount ?? 0) === 0}
        />
      )}
      <div className="text-center space-y-3">
        <p className="text-dc-muted text-sm">Duel Commander · Tous contre tous · Top 4</p>

        {(totalMatchCount ?? 0) > 0 && (
          <div className="inline-flex items-center gap-2 bg-dc-surface border border-dc-border rounded-full px-4 py-1.5 text-sm">
            <Sword className="w-3.5 h-3.5 text-dc-gold" />
            <span className="text-dc-muted">
              <span className="text-dc-text font-semibold">{played}</span>
              {' '}/ {totalMatchCount} matchs joués
            </span>
          </div>
        )}
      </div>

      {(totalMatchCount ?? 0) === 0 ? (
        <div className="text-center py-16 text-dc-muted">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>La ligue n&apos;a pas encore démarré.</p>
          <p className="text-sm mt-1">{leaderboard.length} joueur{leaderboard.length > 1 ? 's' : ''} inscrit{leaderboard.length > 1 ? 's' : ''}.</p>
        </div>
      ) : (
        <LeaderboardTable
          players={leaderboardWithDecks}
          totalPlayers={leaderboard.length}
        />
      )}
    </div>
  )
}
