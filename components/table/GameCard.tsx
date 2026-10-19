'use client'

import type { Catalog, CardView, VisibleCard } from '@/lib/game/types'
import { cardInfo, tokenBadge } from '@/lib/game/apply'
import { effectDelay, hasFlying, isLegendary } from '@/lib/game/card-effects'
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
  // Loyauté : écusson dessiné en SVG comme l'encart imprimé (plus large que haut, haut creusé, bas en pointe douce, liseré clair).
  const shape = loyalty
    ? 'bottom-[3.5%] right-[2.5%] w-[max(26px,16cqw)] aspect-[6/5] flex items-center justify-center pb-[0.1em] group'
    : 'bottom-[4.5%] right-[4%] min-w-[20cqw] px-[0.35em] rounded bg-black border border-dc-gold/50'
  const box = `absolute ${shape} text-center text-white text-[length:max(10px,5.5cqw)] leading-[1.6] font-bold whitespace-nowrap`
  const shield = loyalty && (
    <svg viewBox="0 0 120 100" className="absolute inset-0 w-full h-full -z-10 overflow-visible" aria-hidden="true">
      <path
        d="M5 5 Q60 24 115 5 V68 L60 95 L5 68 Z"
        className="fill-black stroke-white/85 group-hover:stroke-dc-gold-light"
        strokeWidth="5"
      />
    </svg>
  )
  // Calque aux dimensions de la carte, conteneur des unités cqw.
  const layer = (child: React.ReactNode) => <div className="absolute inset-0 pointer-events-none [container-type:size]">{child}</div>
  if (!onEdit) return layer(<span className={`${box} isolate`} {...data}>{shield}{content}</span>)
  // Ni glisser (dnd-kit écoute mousedown / touchstart), ni appui long, ni double-clic (engager) depuis l'encart.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return layer(
    <button
      type="button"
      className={`${box} isolate pointer-events-auto cursor-pointer ${loyalty ? '[@media(pointer:coarse)]:w-[max(2.25rem,18cqw)]' : 'hover:border-dc-gold [@media(pointer:coarse)]:min-w-[max(2rem,20cqw)] [@media(pointer:coarse)]:min-h-6'}`}
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
      {shield}
      {content}
    </button>,
  )
}

/**
 * Une carte : image, dos (carte cachée ou face cachée), ou carte texte (jeton sans image), avec marqueurs et taxe.
 * `pt` : encart loyauté ou force/endurance (cartes en jeu) ; `onPtEdit` : encart cliquable pour la modifier.
 * `effects` : effets d'une carte en jeu (liseré doré d'un permanent légendaire, créature volante qui flotte tant
 * qu'elle n'est pas engagée), si le réglage les permet ;
 * `arriving` : carte qui vient d'arriver en jeu (un éclat traverse un légendaire, une seule fois).
 */
export default function GameCard({ card, catalog, lang, tax = 0, className = '', pt = false, onPtEdit, effects = false, arriving = false }: {
  card: CardView | null | undefined
  catalog: Catalog
  lang: Lang
  tax?: number
  className?: string
  pt?: boolean
  onPtEdit?: (at: MenuPoint) => void
  effects?: boolean
  arriving?: boolean
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
  const legendary = effects && isLegendary(catalog, card)
  const flying = effects && !card.tapped && hasFlying(catalog, card)

  const body = (
    <>
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
      {/* Liseré doré, et éclat qui traverse la carte à son arrivée (globals.css), sous les marqueurs et l'encart. */}
      {legendary && <span className="card-legendary" aria-hidden="true">{arriving && <i className="card-glint" />}</span>}
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
    </>
  )

  return (
    <div className={`relative aspect-[63/88] select-none ${className}`} title={data.name}
      data-legendary={legendary || undefined} data-flying={flying || undefined}
      style={flying ? ({ '--fx-delay': effectDelay(card.id) } as React.CSSProperties) : undefined}>
      {flying ? (
        <>
          {/* Créature volante : elle flotte au-dessus de son ombre (globals.css) ; la carte elle-même ne bouge pas (glisser, toucher). */}
          <span className="card-shadow" aria-hidden="true" />
          <div className="card-lift absolute inset-0">{body}</div>
        </>
      ) : body}
    </div>
  )
}
