'use client'

import type { Catalog, CardView } from '@/lib/game/types'
import { cardInfo, tokenBadge } from '@/lib/game/apply'

export type Lang = 'fr' | 'en'

/** Dos de carte ; `bare` : sans le monogramme, pour les tout petits dos. */
export function CardBack({ className = '', bare = false }: { className?: string; bare?: boolean }) {
  return (
    <div className={`aspect-[63/88] rounded-[6%] border border-dc-gold/40 bg-gradient-to-br from-dc-purple via-dc-surface to-dc-blue flex items-center justify-center ${className}`}>
      {!bare && <span className="font-fantasy text-dc-gold/70 text-xs">DC</span>}
    </div>
  )
}

const badgeClass = 'text-white text-[9px] font-semibold uppercase tracking-wide whitespace-nowrap [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]'

/** Une carte : image, dos (carte cachée ou face cachée), ou carte texte (jeton sans image), avec marqueurs et taxe. */
export default function GameCard({ card, catalog, lang, tax = 0, className = '' }: {
  card: CardView | null | undefined
  catalog: Catalog
  lang: Lang
  tax?: number
  className?: string
}) {
  if (!card) return null
  if (card.hidden) return <CardBack className={className} />
  const data = cardInfo(catalog, card, lang)
  if (data.hidden) return <CardBack className={className} />

  const { plus, minus, other } = card.counters
  const net = plus - minus
  const badge = tokenBadge(card)

  return (
    <div className={`relative aspect-[63/88] select-none ${className}`} title={data.name}>
      {data.image ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.image} alt={data.name} draggable={false} className="w-full h-full rounded-[6%] object-cover shadow-card" />
          {/* Comme Moxfield : au milieu de la carte, juste au-dessus de la ligne de type. */}
          {badge && <span className={`${badgeClass} absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-full`} data-token-badge>{badge}</span>}
        </>
      ) : (
        <div className="w-full h-full rounded-[6%] border-2 border-dc-gold/50 bg-dc-surface p-1.5 flex flex-col text-[10px] leading-tight text-dc-text">
          <span className="font-semibold">{data.name}</span>
          {badge && <span className={`${badgeClass} self-center my-1`} data-token-badge>{badge}</span>}
          <span className={`text-dc-muted ${badge ? '' : 'mt-1'}`}>{data.typeLine}</span>
          {card.token?.power != null && (
            <span className="mt-auto self-end font-semibold">{card.token.power}/{card.token.toughness}</span>
          )}
        </div>
      )}
      <div className="absolute top-1 left-1 flex flex-col gap-0.5">
        {net !== 0 && (
          <span className={`px-1 rounded text-[10px] font-bold ${net > 0 ? 'bg-dc-green-light text-black' : 'bg-dc-red-light text-black'}`}>
            {net > 0 ? `+${net}/+${net}` : `${net}/${net}`}
          </span>
        )}
        {other > 0 && <span className="px-1 rounded text-[10px] font-bold bg-dc-gold text-black">{other}</span>}
      </div>
      {tax > 0 && (
        <span className="absolute bottom-1 inset-x-1 text-center rounded bg-black/75 text-dc-gold text-[10px] font-semibold">Taxe +{tax}</span>
      )}
    </div>
  )
}
