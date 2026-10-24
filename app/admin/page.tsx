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
import { aiAdminStatus } from '@/lib/ai/admin'
import { unfinishedTables } from '@/lib/db-games'
import { getMessages } from '@/lib/i18n/server'
import { listErrors } from '@/lib/db-errors'

export const runtime = 'edge'
export const revalidate = 0

export default async function AdminPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect('/connexion?from=/admin')
  if (!(await isAdminAuthenticated())) redirect('/')

  const env = getRequestContext<CloudflareEnv>().env
  const db = env.DB
  // Journal des erreurs hors de loadFailed : illisible, il ne doit pas fermer l'administration.
  const [results, ai, errors] = await Promise.all([
    Promise.all([listPlayers(db), listAccountStatuses(db, new Date()), listLeagues(db), unfinishedTables(db)]),
    aiAdminStatus(env, new Date()),
    listErrors(db),
  ])
  if (loadFailed(...results)) return <LoadError what={(await getMessages()).admin.dashboard.loadWhat} />
  const [players, statuses, leagues, tables] = results

  return (
    <AdminDashboard
      players={(players.data ?? []) as unknown as Player[]}
      accountStatuses={statuses.data ?? {}}
      leagues={leagues.data ?? []}
      ai={ai}
      tables={tables.data ?? []}
      errors={errors.data}
      currentUserId={currentUser.id}
      isBootstrap={currentUser.isBootstrap}
    />
  )
}
