import { notFound } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getCurrentUser } from '@/lib/auth/session'
import { canEditDeck } from '@/lib/auth/permissions'
import { getPlayer } from '@/lib/db'
import { getDeck } from '@/lib/db-decks'
import { listDeckCards } from '@/lib/db-cards'
import DeckView from './DeckView'
import LoadError from '@/components/LoadError'

export const runtime = 'edge'

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { env } = getRequestContext<CloudflareEnv>()
  const { data: deck, error } = await getDeck(env.DB, id)
  if (error) return <LoadError what="ce deck" />
  if (!deck) notFound()

  const [{ data: player, error: playerError }, { data: cards, error: cardsError }, user] = await Promise.all([
    getPlayer(env.DB, deck.player_id),
    listDeckCards(env.DB, deck.id),
    getCurrentUser(),
  ])
  if (playerError || cardsError) return <LoadError what="ce deck" />

  return (
    <DeckView
      deck={deck}
      playerName={player?.name ?? ''}
      cards={cards ?? []}
      canEdit={!!user && canEditDeck(user, deck)}
    />
  )
}
