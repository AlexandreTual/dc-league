'use client'

import { cardSrcSet } from '@/lib/cards/images'
import { cardPreview } from '@/lib/game/card-preview'
import type { Catalog, CardView } from '@/lib/game/types'
import type { Lang } from './GameCard'
import { PREVIEW_WIDTH, previewBox } from './touch'

/**
 * Grande image de la carte survolée, jamais pour une carte cachée (`cardPreview`, règle commune avec le menu au doigt).
 * Dans une fenêtre étroite à la souris, centrée et bornée à l'écran (`previewBox`). Jamais au doigt (`tablet:hidden`) :
 * l'image est dans le menu ouvert par l'appui long.
 */
export default function PreviewPane({ card, catalog, lang }: { card: CardView | null; catalog: Catalog; lang: Lang }) {
  const data = cardPreview(card, catalog, lang)
  if (!data) return null
  const small = typeof window === 'undefined' ? null : previewBox({ width: window.innerWidth, height: window.innerHeight })
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={data.image}
      // 288 px CSS : sur écran haute densité, l'image normale (488 px) serait agrandie, donc floue.
      srcSet={cardSrcSet(data.image, data.imageLarge)}
      sizes={`${small?.width ?? PREVIEW_WIDTH}px`}
      alt={data.name}
      className={`pointer-events-none fixed z-50 rounded-2xl shadow-card tablet:hidden ${small ? '' : 'bottom-4 right-44 w-72'}`}
      style={small ?? undefined}
      data-testid="preview"
    />
  )
}
