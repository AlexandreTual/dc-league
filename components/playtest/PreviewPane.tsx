'use client'

import { cardInfo } from '@/lib/game/apply'
import type { Catalog, CardView } from '@/lib/game/types'
import type { Lang } from './GameCard'

/** Grande image de la carte survolée, jamais pour une carte cachée. */
export default function PreviewPane({ card, catalog, lang }: { card: CardView | null; catalog: Catalog; lang: Lang }) {
  if (!card || card.hidden) return null
  const data = cardInfo(catalog, card, lang)
  if (data.hidden || !data.image) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={data.image} alt={data.name} className="pointer-events-none fixed bottom-4 right-44 z-50 w-72 rounded-2xl shadow-card" data-testid="preview" />
  )
}
