import { redirect } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth/session'
import { listTables } from '@/lib/db-games'
import Lobby from '@/components/online/Lobby'
import LoadError from '@/components/LoadError'

export const runtime = 'edge'

export default async function SalonPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/connexion?from=/salon')
  if (user.isBootstrap) redirect('/admin')

  const { data: tables, error } = await listTables(getRequestContext<CloudflareEnv>().env.DB)
  if (error) return <LoadError what="les tables du salon" />
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="font-fantasy text-2xl font-bold text-dc-gold">Salon</h1>
      <Lobby me={user.playerId} initialTables={tables ?? []} />
    </div>
  )
}
