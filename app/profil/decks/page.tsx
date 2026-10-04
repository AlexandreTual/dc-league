import { redirect } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth/session'
import { listPlayerDecks } from '@/lib/db-decks'
import { countDeckCards } from '@/lib/db-cards'
import MyDecks from './MyDecks'

export const runtime = 'edge'

export default async function MesDecksPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/connexion?from=/profil/decks')
  if (user.isBootstrap) redirect('/admin')

  const { env } = getRequestContext<CloudflareEnv>()
  const { data: decks } = await listPlayerDecks(env.DB, user.playerId)
  const { data: cardCounts } = await countDeckCards(env.DB, (decks ?? []).map((d) => d.id))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="font-fantasy text-2xl font-bold text-dc-gold">Mes decks</h1>
      <MyDecks playerId={user.playerId} initialDecks={decks ?? []} cardCounts={cardCounts ?? {}} />
    </div>
  )
}
