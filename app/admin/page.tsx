import { getRequestContext } from '@cloudflare/next-on-pages'
import { listPlayers, listMatches, listPlayoffs, countMatches, countCompletedMatches, getPlayerIdsWithHistory } from '@/lib/db'
import { Player, Match } from '@/lib/leaderboard'
import { getActiveLeague, listLeaguePlayers } from '@/lib/db-leagues'
import { listAllDecksGrouped } from '@/lib/db-decks'
import { listAccountStatuses } from '@/lib/db-auth'
import { getCurrentUser, isAdminAuthenticated } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import AdminDashboard from './AdminDashboard'
import LoadError from '@/components/LoadError'
import { loadFailed } from '@/lib/load'

export const runtime = 'edge'
export const revalidate = 0

export default async function AdminPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/connexion?from=/admin')
  if (!(await isAdminAuthenticated())) redirect('/')

  const { env } = getRequestContext<CloudflareEnv>()
  const db = env.DB

  const first = await Promise.all([
    getActiveLeague(db),
    listPlayers(db),
    listAllDecksGrouped(db),
    getPlayerIdsWithHistory(db),
    listAccountStatuses(db, new Date()),
  ])
  const [
    { data: activeLeague },
    { data: players },
    { data: decks },
    { data: playerIdsWithHistory },
    { data: accountStatuses },
  ] = first

  const second = await Promise.all([
    activeLeague ? listMatches(db, activeLeague.id, true) : Promise.resolve({ data: [] }),
    activeLeague ? listPlayoffs(db, activeLeague.id) : Promise.resolve({ data: [] }),
    activeLeague ? countMatches(db, activeLeague.id) : Promise.resolve({ data: 0 }),
    activeLeague ? countCompletedMatches(db, activeLeague.id) : Promise.resolve({ data: 0 }),
    activeLeague ? listLeaguePlayers(db, activeLeague.id) : Promise.resolve({ data: [] }),
  ])
  // Sans ces données, l'admin proposerait par erreur de créer une saison ou afficherait une ligue vide.
  if (loadFailed(...first, ...second)) return <LoadError what="l'administration" />
  const [
    { data: matches },
    { data: playoffs },
    { data: total },
    { data: completed },
    { data: leaguePlayers },
  ] = second

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
      accountStatuses={accountStatuses ?? {}}
      currentUserId={currentUser?.id ?? null}
      isBootstrap={currentUser?.isBootstrap ?? false}
    />
  )
}
