'use client'

import { cardInfo } from '@/lib/game/apply'
import type { Catalog, CardView } from '@/lib/game/types'
import type { Lang } from './GameCard'
import { previewBox } from './touch'

/**
 * Grande image de la carte survolée, jamais pour une carte cachée. Sur petit écran, centrée et bornée
 * à l'écran ; au doigt, la table la masque au toucher suivant.
 */
export default function PreviewPane({ card, catalog, lang }: { card: CardView | null; catalog: Catalog; lang: Lang }) {
  if (!card || card.hidden) return null
  const data = cardInfo(catalog, card, lang)
  if (data.hidden || !data.image) return null
  const small = typeof window === 'undefined' ? null : previewBox({ width: window.innerWidth, height: window.innerHeight })
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={data.image}
      alt={data.name}
      className={`pointer-events-none fixed z-50 rounded-2xl shadow-card ${small ? '' : 'bottom-4 right-44 w-72'}`}
      style={small ?? undefined}
      data-testid="preview"
    />
  )
}
