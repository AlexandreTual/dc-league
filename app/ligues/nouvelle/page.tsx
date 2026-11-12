import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import { getMessages } from '@/lib/i18n/server'
import NewLeagueForm from './NewLeagueForm'

export const runtime = 'edge'

/** Création d'une ligue : réservée aux joueurs connectés. */
export default async function NewLeaguePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/connexion?from=/ligues/nouvelle')
  if (user.isBootstrap) redirect('/ligues')
  const t = (await getMessages()).leagues.create
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="font-fantasy text-3xl font-bold text-dc-gold">{t.title}</h1>
      <p className="text-dc-muted text-sm">{t.intro}</p>
      <NewLeagueForm />
    </div>
  )
}
