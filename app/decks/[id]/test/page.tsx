import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getRequestContext } from '@cloudflare/next-on-pages'
import { getDeck } from '@/lib/db-decks'
import { listDeckCards } from '@/lib/db-cards'
import { buildCatalog } from '@/lib/game/catalog'
import LocalTable from '@/components/table/LocalTable'

export const runtime = 'edge'

export default async function PlaytestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { env } = getRequestContext<CloudflareEnv>()
  const { data: deck } = await getDeck(env.DB, id)
  if (!deck) notFound()
  const { data: cards } = await listDeckCards(env.DB, deck.id)
  const { catalog, excluded } = buildCatalog(deck.id, cards ?? [])

  if (catalog.entries.length === 0) {
    return (
      <div className="text-center space-y-3 py-16">
        <p className="text-dc-text">Importe d&apos;abord la liste du deck pour pouvoir le tester.</p>
        <Link href="/profil/decks" className="text-dc-gold hover:underline">Aller à mes decks</Link>
      </div>
    )
  }

  // Le plateau couvre toute la fenêtre, barre du site comprise ; « ← nom du deck » ramène au site.
  return (
    <div className="fixed inset-0 z-[60] bg-dc-bg" data-table-root>
      <LocalTable catalog={catalog} excluded={excluded} deckName={deck.name} />
    </div>
  )
}
