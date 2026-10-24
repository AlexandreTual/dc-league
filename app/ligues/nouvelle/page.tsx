import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/session'
import NewLeagueForm from './NewLeagueForm'

export const runtime = 'edge'

export const metadata: Metadata = { title: 'Nouvelle ligue' }

/** Création d'une ligue : réservée aux joueurs connectés. */
export default async function NewLeaguePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/connexion?from=/ligues/nouvelle')
  if (user.isBootstrap) redirect('/ligues')
  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="font-fantasy text-3xl font-bold text-dc-gold">Créer une ligue</h1>
      <p className="text-dc-muted text-sm">
        Tu en seras l&apos;organisateur : tu inscris les joueurs (ou tu leur envoies un lien), tu génères les matchs,
        tu saisis les scores et tu lances les playoffs.
      </p>
      <NewLeagueForm />
    </div>
  )
}
