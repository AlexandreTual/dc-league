'use client'

import { useDroppable } from '@dnd-kit/core'
import { taxOf } from '@/lib/game/apply'
import type { Catalog, CardView, PlayerView, VisibleCard, ZoneRef } from '@/lib/game/types'
import Draggable from './Draggable'
import GameCard, { CardBack, type Lang } from './GameCard'
import { longPressClass, menuGesture, type MenuPoint } from './touch'
import { battlefieldStyle, cardSize, DEFAULT_TABLE_SETTINGS, type TableSettings } from '@/lib/table-settings'

/** Identifiant de dépôt d'une zone : « joueur:zone ». */
export const dropId = (ref: ZoneRef) => `${ref.player}:${ref.zone}`
/** Identifiant glissé pour la carte du dessus de la bibliothèque d'un joueur (inconnue du navigateur). */
export const topId = (player: string) => `top:${player}`

export type CardHandlers = {
  onDoubleClick: (id: string, zone: ZoneRef) => void
  /** Clic droit ou appui long sur une carte. */
  onContextMenu: (id: string, zone: ZoneRef, at: MenuPoint) => void
  onHover: (id: string | null) => void
}

export type ZoneProps = {
  view: PlayerView
  player: string
  catalogs: Record<string, Catalog>
  lang: Lang
  handlers: CardHandlers
  /** Cartes déplaçables par l'utilisateur. */
  interactive: boolean
  /** Cartes à mettre en évidence (repères d'activité). */
  highlighted?: Set<string>
  /** Réglages d'affichage (quadrillage, couleur du fond, taille des cartes). */
  settings?: TableSettings
}

const visible = (cards: CardView[]) => cards.filter((c): c is VisibleCard => !c.hidden)

/** Carte du dessus de la bibliothèque d'un joueur, si celui qui regarde la connaît (révélée, regardée…). */
export const libraryTop = (view: PlayerView, player: string): VisibleCard | null =>
  view.players[player]?.zones.library.visible.find((v) => v.index === 0)?.card ?? null

function useZone(ref: ZoneRef) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId(ref), data: ref })
  return { setNodeRef, highlight: isOver ? 'ring-2 ring-dc-gold/60' : '' }
}

function cardProps(id: string, zone: ZoneRef, props: ZoneProps) {
  const { handlers } = props
  return {
    id,
    from: zone,
    disabled: !props.interactive,
    highlight: props.highlighted?.has(id) ?? false,
    onDoubleClick: () => handlers.onDoubleClick(id, zone),
    onContextMenu: (at: MenuPoint) => handlers.onContextMenu(id, zone, at),
    onHover: (h: boolean) => handlers.onHover(h ? id : null),
  }
}

export function Battlefield(props: ZoneProps & { label?: string }) {
  const { view, player, catalogs, lang } = props
  const ref: ZoneRef = { player, zone: 'battlefield' }
  const { setNodeRef, highlight } = useZone(ref)
  const settings = props.settings ?? DEFAULT_TABLE_SETTINGS
  const size = cardSize(settings.cardScale)
  return (
    <div ref={setNodeRef} data-zone="battlefield" data-player={player} style={battlefieldStyle(settings)}
      className={`relative flex-1 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/40 ${highlight}`}>
      <span className="absolute top-2 left-3 text-dc-muted text-xs pointer-events-none">{props.label ?? 'Champ de bataille'}</span>
      {visible(view.players[player].zones.battlefield).map((card) => (
        <Draggable
          key={card.id}
          {...cardProps(card.id, ref, props)}
          className="absolute"
          style={{ ...size, left: `${card.x}%`, top: `${card.y}%`, transform: `translate(-50%, -50%) rotate(${card.tapped ? 90 : 0}deg)`, transition: 'transform 150ms' }}
        >
          <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} />
        </Draggable>
      ))}
    </div>
  )
}

/** Main : mes cartes face visible ; celle d'un autre en dos de carte (seulement leur nombre est connu). */
export function Hand(props: ZoneProps & { onZoneContextMenu?: (at: MenuPoint) => void }) {
  const { view, player, catalogs, lang } = props
  const ref: ZoneRef = { player, zone: 'hand' }
  const { setNodeRef, highlight } = useZone(ref)
  const hand = view.players[player].zones.hand
  const press = menuGesture(props.onZoneContextMenu)
  return (
    <div
      ref={setNodeRef}
      data-zone="hand"
      data-player={player}
      className={`relative flex-1 min-w-0 min-h-0 flex items-center justify-center gap-1 px-4 py-2 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/60 ${longPressClass} ${highlight}`}
      {...press}
    >
      <span className="absolute top-1 left-3 text-dc-muted text-xs pointer-events-none">Main ({hand.length})</span>
      {hand.map((card, i) =>
        card.hidden ? (
          <CardBack key={`h${i}`} className="h-[90%]" />
        ) : (
          // La carte peut rétrécir (minWidth) pour se chevaucher quand la main est pleine.
          <Draggable key={card.id} {...cardProps(card.id, ref, props)} className="h-[90%] hover:-translate-y-2 transition-transform" style={{ flex: '0 1 auto', minWidth: 24 }}>
            <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} className="h-full" />
          </Draggable>
        ),
      )}
    </div>
  )
}

/** Cartes affichées au plus dans la main compacte d'un adversaire. */
const COMPACT_HAND_MAX = 10

/**
 * Main d'un adversaire en bande fine (vue agrandie, Duel) : son nombre et de petits dos qui se chevauchent.
 * Reste une cible de dépôt (`data-zone="hand"`) ; une carte révélée s'y affiche face visible, avec son aperçu.
 */
export function OpponentHand(props: ZoneProps) {
  const { view, player, catalogs, lang } = props
  const ref: ZoneRef = { player, zone: 'hand' }
  const { setNodeRef, highlight } = useZone(ref)
  const hand = view.players[player].zones.hand
  const shown = hand.slice(0, COMPACT_HAND_MAX)
  return (
    <div
      ref={setNodeRef}
      data-zone="hand"
      data-player={player}
      className={`h-7 shrink-0 flex items-center gap-2 px-3 rounded-lg border border-dc-border bg-dc-surface/60 ${highlight}`}
    >
      <span className="text-dc-muted text-xs shrink-0">Main : {hand.length}</span>
      <div className="h-5 flex items-center">
        {shown.map((card, i) =>
          card.hidden ? (
            <CardBack key={`h${i}`} bare className={`h-full ${i > 0 ? '-ml-1.5' : ''}`} />
          ) : (
            <Draggable key={card.id} {...cardProps(card.id, ref, props)} className={`h-full ${i > 0 ? '-ml-1.5' : ''}`}>
              <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} className="h-full" />
            </Draggable>
          ),
        )}
      </div>
      {hand.length > COMPACT_HAND_MAX && <span className="text-dc-muted text-xs">+{hand.length - COMPACT_HAND_MAX}</span>}
    </div>
  )
}

/** Nom court affiché sous une pile, suivi du nombre de cartes. */
const PILE_LABELS: Record<'command' | 'library' | 'graveyard' | 'exile', string> = {
  command: 'Cmd', library: 'Bib.', graveyard: 'Cim.', exile: 'Exil',
}

/** Décalage d'un commandant sur le précédent, en largeur de carte (deux commandants légèrement décalés). */
const COMMANDER_SHIFT = 0.4

/**
 * Pile en vignette au format carte (à droite de ma main ; `mini` sur la ligne fine d'un adversaire agrandi).
 * Bibliothèque : dos de carte, ou la carte du dessus face visible quand elle est connue ;
 * seul son propriétaire peut la glisser (identifiant `top:<joueur>`, résolu par le moteur avec moveTop).
 * Le clic droit (ou l'appui long) y ouvre toujours le menu de la bibliothèque.
 */
export function ZonePile(props: ZoneProps & {
  zone: 'command' | 'library' | 'graveyard' | 'exile'
  me: string | null
  size: 'tile' | 'mini'
  onPileClick?: () => void
  onPileContextMenu?: (at: MenuPoint) => void
}) {
  const { view, player, catalogs, lang, zone } = props
  const ref: ZoneRef = { player, zone }
  const { setNodeRef, highlight } = useZone(ref)
  const zones = view.players[player].zones
  const count = zone === 'library' ? zones.library.count : zones[zone].length
  // Commandement : toutes les cartes. Autres piles : la dernière carte arrivée est visible.
  const cards = zone === 'library' ? [] : zone === 'command' ? visible(zones.command) : visible(zones[zone]).slice(-1)
  const empty = count === 0
  const canDrawTop = zone === 'library' && count > 0 && player === props.me && props.interactive
  const top = zone === 'library' ? libraryTop(view, player) : null
  const topFace = top
    ? <GameCard card={top} catalog={catalogs[top.owner]} lang={lang} className="h-full" />
    : <CardBack className="h-full" bare={props.size === 'mini'} />
  const hoverTop = top ? (h: boolean) => props.handlers.onHover(h ? top.id : null) : undefined
  const press = menuGesture(props.onPileContextMenu)
  // Plusieurs commandants : la vignette s'élargit pour les montrer décalés.
  const span = 1 + COMMANDER_SHIFT * Math.max(0, cards.length - 1)
  const mini = props.size === 'mini'
  return (
    <div
      ref={setNodeRef}
      data-zone={zone}
      data-player={player}
      data-count={count}
      className={`relative h-full shrink-0 flex flex-col items-center gap-0.5 rounded-lg ${props.onPileClick ? 'cursor-pointer' : ''} ${props.onPileContextMenu ? longPressClass : ''} ${highlight}`}
      title={mini ? undefined : `${PILE_LABELS[zone]} ${count}`}
      onClick={props.onPileClick}
      {...press}
    >
      <div className={`relative ${mini ? 'h-[calc(100%-12px)]' : 'h-[calc(100%-14px)]'}`} style={{ aspectRatio: `${63 * span} / 88` }}>
        {empty && <div className="h-full aspect-[63/88] rounded-[6%] border border-dashed border-dc-border" />}
        {zone === 'library' && !empty && (
          canDrawTop ? (
            <Draggable id={topId(player)} from={ref} className="h-full" onDoubleClick={() => props.handlers.onDoubleClick(topId(player), ref)} onHover={hoverTop}>
              {topFace}
            </Draggable>
          ) : (
            <div className="h-full" onMouseEnter={() => hoverTop?.(true)} onMouseLeave={() => hoverTop?.(false)}>
              {topFace}
            </div>
          )
        )}
        {cards.map((card, i) => (
          <Draggable key={card.id} {...cardProps(card.id, ref, props)} className="absolute top-0 h-full" style={{ left: `${(i * COMMANDER_SHIFT * 100) / span}%` }}>
            <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} tax={zone === 'command' ? taxOf(view, card.id) : 0} className="h-full" />
          </Draggable>
        ))}
      </div>
      <span className={`${mini ? 'text-[9px]' : 'text-[10px]'} leading-none text-dc-muted whitespace-nowrap`}>{PILE_LABELS[zone]} {count}</span>
    </div>
  )
}
