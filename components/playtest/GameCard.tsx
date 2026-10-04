'use client'

import type { Catalog, GameState } from '@/lib/game/types'
import { cardData, taxOf } from '@/lib/game/apply'

export type Lang = 'fr' | 'en'

export function CardBack({ className = '' }: { className?: string }) {
  return (
    <div className={`aspect-[63/88] rounded-[6%] border border-dc-gold/40 bg-gradient-to-br from-dc-purple via-dc-surface to-dc-blue flex items-center justify-center ${className}`}>
      <span className="font-fantasy text-dc-gold/70 text-xs">DC</span>
    </div>
  )
}

/** Une carte : image, dos, ou carte texte (jeton sans image), avec marqueurs et taxe. */
export default function GameCard({ id, state, catalog, lang, faceDown = false, className = '' }: {
  id: string
  state: GameState
  catalog: Catalog
  lang: Lang
  faceDown?: boolean
  className?: string
}) {
  const card = state.cards[id]
  if (!card) return null
  const data = cardData(state, catalog, id, lang)
  if (faceDown || data.hidden) return <CardBack className={className} />

  const { plus, minus, other } = card.counters
  const net = plus - minus
  const tax = card.isCommander && state.zones.command.includes(id) ? taxOf(state, id) : 0

  return (
    <div className={`relative aspect-[63/88] select-none ${className}`} title={data.name}>
      {data.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.image} alt={data.name} draggable={false} className="w-full h-full rounded-[6%] object-cover shadow-card" />
      ) : (
        <div className="w-full h-full rounded-[6%] border-2 border-dc-gold/50 bg-dc-surface p-1.5 flex flex-col text-[10px] leading-tight text-dc-text">
          <span className="font-semibold">{data.name}</span>
          <span className="text-dc-muted mt-1">{data.typeLine}</span>
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
