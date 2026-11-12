'use client'

import { cardSrcSet } from '@/lib/cards/images'
import { cardPreview } from '@/lib/game/card-preview'
import type { Catalog, CardView } from '@/lib/game/types'
import type { Lang } from './GameCard'
import { CARD_RATIO, PREVIEW_WIDTH, previewBox } from './touch'
import { useT } from '@/components/i18n/I18nProvider'

/**
 * Grande image de la carte survolée, jamais pour une carte cachée (`cardPreview`, règle commune avec le menu au doigt).
 * Dans une fenêtre étroite à la souris, centrée et bornée à l'écran (`previewBox`). Jamais au doigt (`tablet:hidden`) :
 * l'image est dans le menu ouvert par l'appui long.
 */
export default function PreviewPane({ card, catalog, lang }: { card: CardView | null; catalog: Catalog; lang: Lang }) {
  const t = useT()
  const data = cardPreview(card, catalog, lang, t)
  if (!data) return null
  const small = typeof window === 'undefined' ? null : previewBox({ width: window.innerWidth, height: window.innerHeight })
  const image = (
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
  if (!data.abilities) return image
  // Capacités données ou perdues en toutes lettres : juste au-dessus de l'image (en dessous dans une fenêtre étroite).
  const captionClass = 'pointer-events-none fixed z-50 rounded-lg bg-black/90 border border-dc-gold/50 px-2 py-1 text-xs text-dc-gold-light tablet:hidden'
  const captionStyle = small
    ? { left: small.left, top: small.top + small.height + 4, width: small.width }
    : { right: '11rem', bottom: `calc(1rem + ${PREVIEW_WIDTH / CARD_RATIO + 6}px)`, width: PREVIEW_WIDTH }
  return (
    <>
      {image}
      <div className={captionClass} style={captionStyle} data-testid="preview-abilities">
        {data.abilities.map((line) => <p key={line}>{line}</p>)}
      </div>
    </>
  )
}
