'use client'

import { memo } from 'react'
import type { Catalog, CardView, VisibleCard } from '@/lib/game/types'
import { cardInfo, tokenBadge } from '@/lib/game/apply'
import { Crown } from 'lucide-react'
import { commanderEntrance, effectDelay, hasFlying, isLegendary, type Arrival } from '@/lib/game/card-effects'
import { loyaltyStats } from '@/lib/game/loyalty'
import { ptStats, ptText, type PtValue } from '@/lib/game/pt'
import { NO_EFFECTS, type AbilityStyle, type CardEffects } from '@/lib/table-settings'
import { AbilityBadges } from './abilities'
import type { MenuPoint } from './touch'
import { useT } from '@/components/i18n/I18nProvider'

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
  const c = useT().table.card
  const loyalty = loyaltyStats(catalog, card)
  const stats = loyalty ? null : ptStats(catalog, card)
  if (!loyalty && !stats) return null
  const text = loyalty ? loyalty.text : `${stats!.power.text}/${stats!.toughness.text}`
  // Modification jusqu'à la fin du tour : liseré en pointillés (comme une capacité donnée pour ce tour), détail au survol.
  const turn = !loyalty && card.ptTurn && (card.ptTurn.power !== 0 || card.ptTurn.toughness !== 0) ? ptText(card.ptTurn) : null
  const label = loyalty ? c.loyalty(text) : c.pt(text, turn)
  const data = loyalty ? { 'data-loyalty': text } : { 'data-pt': text, ...(turn ? { 'data-pt-turn': turn } : {}) }
  const content = loyalty
    ? <span className={statClass(loyalty)}>{loyalty.text}</span>
    : <><span className={statClass(stats!.power)}>{stats!.power.text}</span>/<span className={statClass(stats!.toughness)}>{stats!.toughness.text}</span></>
  // À l'échelle de la carte (cqw = % de sa largeur) pour couvrir l'encart imprimé, 10 px au moins sur les petites cartes.
  // Loyauté : écusson dessiné en SVG comme l'encart imprimé (plus large que haut, haut creusé, bas en pointe douce, liseré clair).
  const shape = loyalty
    ? 'bottom-[3.5%] right-[2.5%] w-[max(26px,16cqw)] aspect-[6/5] flex items-center justify-center pb-[0.1em] group'
    : `bottom-[4.5%] right-[4%] min-w-[20cqw] px-[0.35em] rounded bg-black border border-dc-gold/50 ${turn ? 'border-dashed !border-dc-gold' : ''}`
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
  if (!onEdit) return layer(<span className={`${box} isolate`} title={turn ? label : undefined} {...data}>{shield}{content}</span>)
  // Ni glisser (dnd-kit écoute mousedown / touchstart), ni appui long, ni double-clic (engager) depuis l'encart.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation()
  return layer(
    <button
      type="button"
      className={`${box} isolate pointer-events-auto cursor-pointer ${loyalty ? '[@media(pointer:coarse)]:w-[max(2.25rem,18cqw)]' : 'hover:border-dc-gold [@media(pointer:coarse)]:min-w-[max(2rem,20cqw)] [@media(pointer:coarse)]:min-h-6'}`}
      {...data}
      aria-label={c.edit(label)}
      title={turn ? label : undefined}
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

/** Pierre tombale qui se fend en deux au-dessus d'une carte ramenée du cimetière, avec une brume et des éclats (globals.css). */
function GraveBreak() {
  return (
    <span className="card-grave" aria-hidden="true">
      <span className="card-grave-mist" />
      <svg viewBox="0 0 40 48" className="card-grave-stone">
        <g className="card-grave-half card-grave-left">
          <path d="M26 3.2 L24 13 L28 21 L23 30 L27 39 L24 48 H4 V18 A16 16 0 0 1 26 3.2 Z" />
          <path d="M14 10 V26 M9 15 H19" className="card-grave-cross" />
        </g>
        <g className="card-grave-half card-grave-right">
          <path d="M26 3.2 A16 16 0 0 1 36 18 V48 H24 L27 39 L23 30 L28 21 L24 13 Z" />
        </g>
      </svg>
      <i className="card-grave-chip" />
      <i className="card-grave-chip" />
      <i className="card-grave-chip" />
    </span>
  )
}

/**
 * Une carte : image, dos (carte cachée ou face cachée), ou carte texte (jeton sans image), avec marqueurs et taxe.
 * `pt` : encart loyauté ou force/endurance (cartes en jeu) ; `onPtEdit` : encart cliquable pour la modifier.
 * `effects` : animations d'une carte en jeu permises par le réglage (liseré doré d'un permanent légendaire, entrée du
 * commandant, retour du cimetière, créature volante qui flotte tant qu'elle n'est pas engagée), chacune activée ou non ;
 * `arriving` : carte qui vient d'arriver en jeu, et d'où (un éclat traverse un légendaire ; un commandant se pose avec halo,
 *   ondes et couronne ; une carte ramenée du cimetière sort d'une pierre tombale qui se brise ; une seule fois) ;
 * `abilityStyle` : carte en jeu, capacités données ou perdues affichées en symboles ou en libellés (même sans animations).
 * Carte en jeu (`pt`) hors phase : estompée, avec la mention « Hors phase ».
 * Mémoïsée : une carte dont rien n'a changé (même objet de la vue, mêmes réglages) n'est pas redessinée avec la table.
 */
function GameCard({ card, catalog, lang, tax = 0, className = '', pt = false, onPtEdit, effects = NO_EFFECTS, arriving, abilityStyle }: {
  card: CardView | null | undefined
  catalog: Catalog
  lang: Lang
  tax?: number
  className?: string
  pt?: boolean
  onPtEdit?: (at: MenuPoint) => void
  effects?: CardEffects
  arriving?: Arrival
  abilityStyle?: AbilityStyle
}) {
  const c = useT().table.card
  if (!card) return null
  if (card.hidden) return <CardBack className={className} />
  const data = cardInfo(catalog, card, lang)
  const ptBox = pt && <StatBox card={card} catalog={catalog} onEdit={onPtEdit} />
  const phasedOut = pt && !!card.phasedOut
  // Absent (serveur de jeu plus ancien) : la carte s'affiche normalement.
  const phased = (content: React.ReactNode) => !phasedOut ? content : (
    <>
      <div className="absolute inset-0 opacity-35 grayscale">{content}</div>
      <span className="absolute inset-0 flex items-center justify-center pointer-events-none" data-phased-out>
        <span className={`${badgeClass} rounded bg-black/75 px-1 py-0.5`}>{c.phasedOut}</span>
      </span>
    </>
  )
  if (data.hidden) {
    // Carte face cachée vue par qui la connaît : son dos, et sa force 2/2 modifiable.
    if (!ptBox && !phasedOut) return <CardBack className={className} />
    return (
      <div className={`relative aspect-[63/88] select-none ${className}`}>
        {phased(<><CardBack className="w-full h-full" />{ptBox}</>)}
      </div>
    )
  }

  const { plus, minus, other } = card.counters
  const net = plus - minus
  const badgeKind = tokenBadge(card)
  const badge = badgeKind && (badgeKind === 'Copie' ? c.copyBadge : c.tokenBadge)
  const legendary = effects.legendary && isLegendary(catalog, card)
  const flying = effects.flying && !card.tapped && !phasedOut && hasFlying(catalog, card)
  const commander = effects.commander && !!arriving && commanderEntrance(card)
  const grave = effects.graveyard && arriving === 'graveyard'

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
      {abilityStyle && <AbilityBadges card={card} style={abilityStyle} />}
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
        <span className="absolute bottom-1 inset-x-1 text-center rounded bg-black/75 text-dc-gold text-[10px] font-semibold">{c.tax(tax)}</span>
      )}
    </>
  )

  // Commandant qui arrive en jeu : il se pose ; carte ramenée du cimetière : elle remonte de sous la tombe (globals.css).
  // Seul l'intérieur bouge, comme pour le vol.
  const landed = commander ? <div className="card-commander-land absolute inset-0">{body}</div>
    : grave ? <div className="card-grave-rise absolute inset-0">{body}</div> : body

  return (
    <div className={`relative aspect-[63/88] select-none ${className}`} title={data.name}
      data-legendary={legendary || undefined} data-flying={flying || undefined} data-commander-arrival={commander || undefined}
      data-grave-arrival={grave || undefined}
      data-phased={phasedOut || undefined}
      style={flying ? ({ '--fx-delay': effectDelay(card.id) } as React.CSSProperties) : undefined}>
      {/* Halo doré derrière le commandant qui arrive. */}
      {commander && <span className="card-commander-glow" aria-hidden="true" />}
      {flying ? (
        <>
          {/* Créature volante : elle flotte au-dessus de son ombre (globals.css) ; la carte elle-même ne bouge pas (glisser, toucher). */}
          <span className="card-shadow" aria-hidden="true" />
          <div className="card-lift absolute inset-0">{landed}</div>
        </>
      ) : phased(landed)}
      {/* Deux ondes dorées autour du commandant qui arrive, et sa couronne au-dessus. */}
      {commander && (
        <>
          <span className="card-commander-wave" aria-hidden="true" />
          <span className="card-commander-wave" aria-hidden="true" />
          <span className="card-commander-crown" aria-hidden="true"><Crown className="w-[60%] h-[60%]" strokeWidth={2.5} /></span>
        </>
      )}
      {grave && <GraveBreak />}
    </div>
  )
}

export default memo(GameCard)
