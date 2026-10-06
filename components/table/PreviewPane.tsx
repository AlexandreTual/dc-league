'use client'

import { cardSrcSet } from '@/lib/cards/images'
import { cardInfo } from '@/lib/game/apply'
import type { Catalog, CardView } from '@/lib/game/types'
import type { Lang } from './GameCard'
import { PREVIEW_WIDTH, previewBox } from './touch'

/**
 * Grande image de la carte survolée, jamais pour une carte cachée. Sur petit écran, centrée et bornée
 * à l'écran ; au doigt, la table la masque au toucher suivant. Jamais sur tablette : l'image est dans le menu de la carte.
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
