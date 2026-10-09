'use client'

import type { Catalog, CardView, VisibleCard } from '@/lib/game/types'
import { cardInfo, tokenBadge } from '@/lib/game/apply'
import { ptStats, type PtValue } from '@/lib/game/pt'
import type { MenuPoint } from './touch'

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

const statClass = (v: PtValue) => (v.delta > 0 ? 'text-dc-green-light' : v.delta < 0 ? 'text-dc-red-light' : 'text-white')

/**
 * Encart force/endurance, en bas à droite comme sur une vraie carte : vert si augmentée, rouge si diminuée.
 * Avec `onEdit`, un bouton qui ouvre sa modification sans déclencher le glisser ni le menu de la carte.
 */
function PtBox({ card, catalog, onEdit }: { card: VisibleCard; catalog: Catalog; onEdit?: (at: MenuPoint) => void }) {
  const stats = ptStats(catalog, card)
  if (!stats) return null
  const text = `${stats.power.text}/${stats.toughness.text}`
  const content = (
    <>
      <span className={statClass(stats.power)}>{stats.power.text}</span>/<span className={statClass(stats.toughness)}>{stats.toughness.text}</span>
    </>
  )
  const box = 'absolute bottom-[3%] right-[3%] px-1 rounded bg-black/80 border border-dc-gold/50 text-white text-[10px] leading-4 font-bold whitespace-nowrap'
  if (!onEdit) return <span className={`${box} pointer-events-none`} data-pt={text}>{content}</span>
  // Ni glisser (dnd-kit écoute mousedown / touchstart), ni appui long, ni double-clic (engager) depuis l'encart.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return (
    <button
      type="button"
      className={`${box} cursor-pointer hover:border-dc-gold [@media(pointer:coarse)]:min-w-8 [@media(pointer:coarse)]:min-h-6`}
      data-pt={text}
      aria-label={`Force et endurance ${text} : modifier`}
      onPointerDown={stop}
      onMouseDown={stop}
      onTouchStart={stop}
      onDoubleClick={stop}
      onClick={(e) => {
        e.stopPropagation()
        onEdit({ clientX: e.clientX, clientY: e.clientY })
      }}
    >
      {content}
    </button>
  )
}

/**
 * Une carte : image, dos (carte cachée ou face cachée), ou carte texte (jeton sans image), avec marqueurs et taxe.
 * `pt` : encart force/endurance (cartes en jeu) ; `onPtEdit` : encart cliquable pour la modifier.
 */
export default function GameCard({ card, catalog, lang, tax = 0, className = '', pt = false, onPtEdit }: {
  card: CardView | null | undefined
  catalog: Catalog
  lang: Lang
  tax?: number
  className?: string
  pt?: boolean
  onPtEdit?: (at: MenuPoint) => void
}) {
  if (!card) return null
  if (card.hidden) return <CardBack className={className} />
  const data = cardInfo(catalog, card, lang)
  const ptBox = pt && <PtBox card={card} catalog={catalog} onEdit={onPtEdit} />
  if (data.hidden) {
    // Carte face cachée vue par qui la connaît : son dos, et sa force 2/2 modifiable.
    if (!ptBox) return <CardBack className={className} />
    return (
      <div className={`relative aspect-[63/88] select-none ${className}`}>
        <CardBack className="w-full h-full" />
        {ptBox}
      </div>
    )
  }

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
          {!pt && card.token?.power != null && (
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
      {ptBox}
      {tax > 0 && (
        <span className="absolute bottom-1 inset-x-1 text-center rounded bg-black/75 text-dc-gold text-[10px] font-semibold">Taxe +{tax}</span>
      )}
    </div>
  )
}
