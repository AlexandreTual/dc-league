import { notFound, redirect } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth/session'
import { getTable } from '@/lib/db-games'
import BoardWindow from '@/components/online/BoardWindow'

export const runtime = 'edge'

/** Plateau d'un adversaire dans une fenêtre à part (partie en ligne, plusieurs écrans). */
export default async function BoardWindowPage({ params }: { params: Promise<{ id: string; joueur: string }> }) {
  const { id, joueur } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/connexion?from=/tables/${id}/plateau/${joueur}`)
  if (user.isBootstrap) redirect('/admin')

  const { env } = getRequestContext<CloudflareEnv>()
  const { data: table } = await getTable(env.DB, id)
  if (!table) notFound()
  // Partie pas encore commencée : la salle d'attente, sur la table.
  if (table.status === 'open' || table.status === 'starting') redirect(`/tables/${id}`)

  return <BoardWindow tableId={table.id} player={decodeURIComponent(joueur)} />
}
