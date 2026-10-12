import { getRequestContext } from '@cloudflare/next-on-pages'
import { listPlayers } from '@/lib/db'
import { Player } from '@/lib/leaderboard'
import { listLeagues } from '@/lib/db-leagues'
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

  const db = getRequestContext<CloudflareEnv>().env.DB
  const results = await Promise.all([listPlayers(db), listAccountStatuses(db, new Date()), listLeagues(db)])
  if (loadFailed(...results)) return <LoadError what="l'administration" />
  const [players, statuses, leagues] = results

  return (
    <AdminDashboard
      players={(players.data ?? []) as unknown as Player[]}
      accountStatuses={statuses.data ?? {}}
      leagues={leagues.data ?? []}
      currentUserId={currentUser.id}
      isBootstrap={currentUser.isBootstrap}
    />
  )
}
