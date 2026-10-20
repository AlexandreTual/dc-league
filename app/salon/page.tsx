import { redirect } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth/session'
import { listTables } from '@/lib/db-games'
import Lobby from '@/components/online/Lobby'
import LoadError from '@/components/LoadError'
import { getMessages } from '@/lib/i18n/server'

export const runtime = 'edge'

export default async function SalonPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/connexion?from=/salon')
  if (user.isBootstrap) redirect('/admin')

  const [t, { data: tables, error }] = await Promise.all([getMessages(), listTables(getRequestContext<CloudflareEnv>().env.DB)])
  if (error) return <LoadError what={t.online.lobby.loadWhat} />
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="font-fantasy text-2xl font-bold text-dc-gold">{t.online.lobby.title}</h1>
      <Lobby me={user.playerId} initialTables={tables ?? []} />
    </div>
  )
}
