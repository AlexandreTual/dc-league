import { notFound, redirect } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth/session'
import { getTable } from '@/lib/db-games'
import { listPlayerDecks } from '@/lib/db-decks'
import { countDeckCards } from '@/lib/db-cards'
import TableView from '@/components/online/TableView'

export const runtime = 'edge'

export default async function TablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/connexion?from=/tables/${id}`)
  if (user.isBootstrap) redirect('/admin')

  const { env } = getRequestContext<CloudflareEnv>()
  const { data: table } = await getTable(env.DB, id)
  if (!table) notFound()
  const { data: decks } = await listPlayerDecks(env.DB, user.playerId)
  const { data: counts } = await countDeckCards(env.DB, (decks ?? []).map((d) => d.id))
  // Seuls les decks dont la liste est importée peuvent être joués.
  const playable = (decks ?? []).filter((d) => (counts?.[d.id] ?? 0) > 0).map((d) => ({ id: d.id, name: d.name }))

  return <TableView me={user.playerId} initialTable={table} myDecks={playable} />
}
