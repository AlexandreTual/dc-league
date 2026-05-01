import { listPlayers, listMatches, listPlayoffs, countMatches, countCompletedMatches } from '@/lib/db'
import { Player, Match } from '@/lib/leaderboard'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'
import { listAllDecksGrouped } from '@/lib/db-decks'
import AdminDashboard from './AdminDashboard'

export const revalidate = 0

export default async function AdminPage() {
  const { data: activeLeague } = getActiveLeague()
  const { data: players } = listPlayers()
  const { data: matches } = activeLeague ? listMatches(activeLeague.id, true) : { data: [] }
  const { data: playoffs } = activeLeague ? listPlayoffs(activeLeague.id) : { data: [] }
  const { data: total } = activeLeague ? countMatches(activeLeague.id) : { data: 0 }
  const { data: completed } = activeLeague ? countCompletedMatches(activeLeague.id) : { data: 0 }
  const { data: leaguePlayers } = activeLeague ? listLeaguePlayers(activeLeague.id) : { data: [] }
  const { data: decks } = listAllDecksGrouped()
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
    />
  )
}
