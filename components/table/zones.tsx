'use client'

import { useDroppable } from '@dnd-kit/core'
import { taxOf } from '@/lib/game/apply'
import type { Catalog, CardView, PlayerView, PlayerZone, VisibleCard, ZoneRef } from '@/lib/game/types'
import Draggable from './Draggable'
import GameCard, { CardBack, type Lang } from './GameCard'

/** Identifiant de dépôt d'une zone : « joueur:zone ». */
export const dropId = (ref: ZoneRef) => `${ref.player}:${ref.zone}`
/** Identifiant glissé pour la carte du dessus de la bibliothèque d'un joueur (inconnue du navigateur). */
export const topId = (player: string) => `top:${player}`

export type CardHandlers = {
  onDoubleClick: (id: string, zone: ZoneRef) => void
  onContextMenu: (id: string, zone: ZoneRef, e: React.MouseEvent) => void
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
}

const visible = (cards: CardView[]) => cards.filter((c): c is VisibleCard => !c.hidden)

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
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      handlers.onContextMenu(id, zone, e)
    },
    onHover: (h: boolean) => handlers.onHover(h ? id : null),
  }
}

export function Battlefield(props: ZoneProps & { label?: string }) {
  const { view, player, catalogs, lang } = props
  const ref: ZoneRef = { player, zone: 'battlefield' }
  const { setNodeRef, highlight } = useZone(ref)
  return (
    <div ref={setNodeRef} data-zone="battlefield" data-player={player} className={`relative flex-1 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/40 ${highlight}`}>
      <span className="absolute top-2 left-3 text-dc-muted text-xs pointer-events-none">{props.label ?? 'Champ de bataille'}</span>
      {visible(view.players[player].zones.battlefield).map((card) => (
        <Draggable
          key={card.id}
          {...cardProps(card.id, ref, props)}
          className="absolute w-[7%] min-w-[72px]"
          style={{ left: `${card.x}%`, top: `${card.y}%`, transform: `translate(-50%, -50%) rotate(${card.tapped ? 90 : 0}deg)`, transition: 'transform 150ms' }}
        >
          <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} />
        </Draggable>
      ))}
    </div>
  )
}

/** Main : mes cartes face visible ; celle d'un autre en dos de carte (seulement leur nombre est connu). */
export function Hand(props: ZoneProps & { onZoneContextMenu?: (e: React.MouseEvent) => void }) {
  const { view, player, catalogs, lang } = props
  const ref: ZoneRef = { player, zone: 'hand' }
  const { setNodeRef, highlight } = useZone(ref)
  const hand = view.players[player].zones.hand
  return (
    <div
      ref={setNodeRef}
      data-zone="hand"
      data-player={player}
      className={`relative h-[28%] flex items-center justify-center gap-1 px-4 py-2 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/60 ${highlight}`}
      onContextMenu={(e) => {
        if (!props.onZoneContextMenu) return
        e.preventDefault()
        props.onZoneContextMenu(e)
      }}
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

const PILE_LABELS: Record<PlayerZone, string> = {
  command: 'Commandement',
  library: 'Bibliothèque',
  graveyard: 'Cimetière',
  exile: 'Exil',
  hand: 'Main',
  battlefield: 'Champ de bataille',
}

/**
 * Pile latérale. Bibliothèque : dos de carte ; seul son propriétaire peut glisser la carte du dessus
 * (identifiant `top:<joueur>`, résolu par le moteur avec moveTop).
 */
export function ZonePile(props: ZoneProps & {
  zone: 'command' | 'library' | 'graveyard' | 'exile'
  me: string | null
  onPileClick?: () => void
  onPileContextMenu?: (e: React.MouseEvent) => void
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
  return (
    <div
      ref={setNodeRef}
      data-zone={zone}
      data-player={player}
      className={`relative rounded-xl border border-dc-border bg-dc-surface/60 p-2 flex flex-col items-center gap-1 min-h-0 ${highlight}`}
      onClick={props.onPileClick}
      onContextMenu={(e) => {
        if (!props.onPileContextMenu) return
        e.preventDefault()
        props.onPileContextMenu(e)
      }}
    >
      <span className="text-dc-muted text-xs">{PILE_LABELS[zone]} ({count})</span>
      <div className={`flex-1 min-h-0 w-full flex ${zone === 'command' ? 'gap-1' : ''} justify-center`}>
        {empty && <div className="aspect-[63/88] h-full rounded-[6%] border border-dashed border-dc-border" />}
        {zone === 'library' && !empty && (
          canDrawTop ? (
            <Draggable id={topId(player)} from={ref} className="h-full" onDoubleClick={() => props.handlers.onDoubleClick(topId(player), ref)}>
              <CardBack className="h-full" />
            </Draggable>
          ) : (
            <CardBack className="h-full" />
          )
        )}
        {cards.map((card) => (
          <Draggable key={card.id} {...cardProps(card.id, ref, props)} className="h-full">
            <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} tax={zone === 'command' ? taxOf(view, card.id) : 0} className="h-full" />
          </Draggable>
        ))}
      </div>
    </div>
  )
}
