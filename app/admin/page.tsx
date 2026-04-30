import { listPlayers, listMatches, listPlayoffs, countMatches, countCompletedMatches } from '@/lib/db'
import { Player, Match } from '@/lib/leaderboard'
import AdminDashboard from './AdminDashboard'

export const revalidate = 0

export default async function AdminPage() {
  const { data: players } = listPlayers()
  const { data: matches } = listMatches(true)
  const { data: playoffs } = listPlayoffs()
  const { data: total } = countMatches()
  const { data: completed } = countCompletedMatches()

  const allRRCompleted = (total ?? 0) > 0 && total === completed

  return (
    <AdminDashboard
      initialPlayers={(players ?? []) as unknown as Player[]}
      initialMatches={(matches ?? []) as unknown as Match[]}
      initialPlayoffs={playoffs ?? []}
      allRRCompleted={allRRCompleted}
    />
  )
}
