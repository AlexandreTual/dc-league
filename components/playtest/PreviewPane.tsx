'use client'

import { cardData } from '@/lib/game/apply'
import type { Catalog, GameState } from '@/lib/game/types'
import type { Lang } from './GameCard'

/** Grande image de la carte survolée, jamais pour une carte cachée. */
export default function PreviewPane({ id, state, catalog, lang }: { id: string | null; state: GameState; catalog: Catalog; lang: Lang }) {
  if (!id || !state.cards[id] || state.zones.library.includes(id)) return null
  const data = cardData(state, catalog, id, lang)
  if (data.hidden || !data.image) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data.image} alt={data.name} className="pointer-events-none fixed bottom-4 right-44 z-50 w-72 rounded-2xl shadow-card" data-testid="preview" />
  )
}
