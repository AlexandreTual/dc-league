import { notFound } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth/session'
import { canEditDeck } from '@/lib/auth/permissions'
import { getPlayer } from '@/lib/db'
import { getDeck } from '@/lib/db-decks'
import { listDeckCards } from '@/lib/db-cards'
import DeckView from './DeckView'

export const runtime = 'edge'

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { env } = getRequestContext<CloudflareEnv>()
  const { data: deck } = await getDeck(env.DB, id)
  if (!deck) notFound()

  const [{ data: player }, { data: cards }, user] = await Promise.all([
    getPlayer(env.DB, deck.player_id),
    listDeckCards(env.DB, deck.id),
    getCurrentUser(),
  ])

  return (
    <DeckView
      deck={deck}
      playerName={player?.name ?? ''}
      cards={cards ?? []}
      canEdit={!!user && canEditDeck(user, deck)}
    />
  )
}
