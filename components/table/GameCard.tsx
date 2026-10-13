'use client'

import type { Catalog, CardView, VisibleCard } from '@/lib/game/types'
import { cardInfo, tokenBadge } from '@/lib/game/apply'
import { loyaltyStats } from '@/lib/game/loyalty'
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
 * Encart en bas à droite, comme sur une vraie carte : loyauté d'un planeswalker, sinon force/endurance ;
 * vert si augmentée, rouge si diminuée. Avec `onEdit`, un bouton qui ouvre sa modification sans déclencher
 * le glisser ni le menu de la carte.
 */
function StatBox({ card, catalog, onEdit }: { card: VisibleCard; catalog: Catalog; onEdit?: (at: MenuPoint) => void }) {
  const loyalty = loyaltyStats(catalog, card)
  const stats = loyalty ? null : ptStats(catalog, card)
  if (!loyalty && !stats) return null
  const text = loyalty ? loyalty.text : `${stats!.power.text}/${stats!.toughness.text}`
  const label = loyalty ? `Loyauté ${text}` : `Force et endurance ${text}`
  const data = loyalty ? { 'data-loyalty': text } : { 'data-pt': text }
  const content = loyalty
    ? <span className={statClass(loyalty)}>{loyalty.text}</span>
    : <><span className={statClass(stats!.power)}>{stats!.power.text}</span>/<span className={statClass(stats!.toughness)}>{stats!.toughness.text}</span></>
  // À l'échelle de la carte (cqw = % de sa largeur) pour couvrir l'encart imprimé, 10 px au moins sur les petites cartes.
  // Loyauté : bas arrondi, comme le bouclier imprimé.
  const shape = loyalty ? 'min-w-[15cqw] rounded-t rounded-b-[45%]' : 'min-w-[20cqw] rounded'
  const box = `absolute bottom-[4.5%] right-[4%] ${shape} px-[0.35em] bg-black border border-dc-gold/50 text-center text-white text-[length:max(10px,5.5cqw)] leading-[1.6] font-bold whitespace-nowrap`
  // Calque aux dimensions de la carte, conteneur des unités cqw.
  const layer = (child: React.ReactNode) => <div className="absolute inset-0 pointer-events-none [container-type:size]">{child}</div>
  if (!onEdit) return layer(<span className={box} {...data}>{content}</span>)
  // Ni glisser (dnd-kit écoute mousedown / touchstart), ni appui long, ni double-clic (engager) depuis l'encart.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return layer(
    <button
      type="button"
      className={`${box} pointer-events-auto cursor-pointer hover:border-dc-gold [@media(pointer:coarse)]:min-w-[max(2rem,20cqw)] [@media(pointer:coarse)]:min-h-6`}
      {...data}
      aria-label={`${label} : modifier`}
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
    </button>,
  )
}

/**
 * Une carte : image, dos (carte cachée ou face cachée), ou carte texte (jeton sans image), avec marqueurs et taxe.
 * `pt` : encart loyauté ou force/endurance (cartes en jeu) ; `onPtEdit` : encart cliquable pour la modifier.
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
  const ptBox = pt && <StatBox card={card} catalog={catalog} onEdit={onPtEdit} />
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
