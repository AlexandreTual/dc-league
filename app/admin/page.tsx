import { getRequestContext } from '@cloudflare/next-on-pages'
import { listPlayers, listMatches, listPlayoffs, countMatches, countCompletedMatches, getPlayerIdsWithHistory } from '@/lib/db'
import { Player, Match } from '@/lib/leaderboard'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'
import { listAllDecksGrouped } from '@/lib/db-decks'
import AdminDashboard from './AdminDashboard'

export const runtime = 'edge'
export const revalidate = 0

export default async function AdminPage() {
  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const [
    { data: activeLeague },
    { data: players },
    { data: decks },
    { data: playerIdsWithHistory },
  ] = await Promise.all([
    getActiveLeague(db),
    listPlayers(db),
    listAllDecksGrouped(db),
    getPlayerIdsWithHistory(db),
  ])

  const [
    { data: matches },
    { data: playoffs },
    { data: total },
    { data: completed },
    { data: leaguePlayers },
  ] = await Promise.all([
    activeLeague ? listMatches(db, activeLeague.id, true) : Promise.resolve({ data: [] }),
    activeLeague ? listPlayoffs(db, activeLeague.id) : Promise.resolve({ data: [] }),
    activeLeague ? countMatches(db, activeLeague.id) : Promise.resolve({ data: 0 }),
    activeLeague ? countCompletedMatches(db, activeLeague.id) : Promise.resolve({ data: 0 }),
    activeLeague ? listLeaguePlayers(db, activeLeague.id) : Promise.resolve({ data: [] }),
  ])

  const allRRCompleted = (total ?? 0) > 0 && total === completed

  return (
    <AdminDashboard
      initialPlayers={(players ?? []) as unknown as Player[]}
      initialMatches={(matches ?? []) as unknown as Match[]}
      initialPlayoffs={playoffs ?? []}
      allRRCompleted={allRRCompleted}
      activeLeague={activeLeague ?? null}
      leaguePlayers={leaguePlayers ?? []}
      initialDecks={decks ?? {}}
      playerIdsWithHistory={playerIdsWithHistory ?? []}
    />
  )
}
