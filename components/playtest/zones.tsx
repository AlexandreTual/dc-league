'use client'

import { useDroppable } from '@dnd-kit/core'
import { taxOf } from '@/lib/game/apply'
import type { Catalog, CardView, PlayerView, PlayerZone, VisibleCard } from '@/lib/game/types'
import Draggable from './Draggable'
import GameCard, { CardBack, type Lang } from './GameCard'

export type CardHandlers = {
  onDoubleClick: (id: string, zone: PlayerZone) => void
  onContextMenu: (id: string, zone: PlayerZone, e: React.MouseEvent) => void
  onHover: (id: string | null) => void
}

type ZoneProps = { view: PlayerView; catalog: Catalog; lang: Lang; handlers: CardHandlers }

const visible = (cards: CardView[]) => cards.filter((c): c is VisibleCard => !c.hidden)

function useZone(zone: PlayerZone) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })
  return { setNodeRef, highlight: isOver ? 'ring-2 ring-dc-gold/60' : '' }
}

function cardProps(id: string, zone: PlayerZone, handlers: CardHandlers) {
  return {
    id,
    from: zone,
    onDoubleClick: () => handlers.onDoubleClick(id, zone),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault()
      handlers.onContextMenu(id, zone, e)
    },
    onHover: (h: boolean) => handlers.onHover(h ? id : null),
  }
}

export function Battlefield({ view, catalog, lang, handlers }: ZoneProps) {
  const { setNodeRef, highlight } = useZone('battlefield')
  return (
    <div ref={setNodeRef} data-zone="battlefield" className={`relative flex-1 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/40 ${highlight}`}>
      <span className="absolute top-2 left-3 text-dc-muted text-xs pointer-events-none">Champ de bataille</span>
      {visible(view.players[view.me].zones.battlefield).map((card) => (
        <Draggable
          key={card.id}
          {...cardProps(card.id, 'battlefield', handlers)}
          className="absolute w-[7%] min-w-[72px]"
          style={{ left: `${card.x}%`, top: `${card.y}%`, transform: `translate(-50%, -50%) rotate(${card.tapped ? 90 : 0}deg)`, transition: 'transform 150ms' }}
        >
          <GameCard card={card} catalog={catalog} lang={lang} />
        </Draggable>
      ))}
    </div>
  )
}

export function Hand({ view, catalog, lang, handlers }: ZoneProps) {
  const { setNodeRef, highlight } = useZone('hand')
  const hand = visible(view.players[view.me].zones.hand)
  return (
    <div ref={setNodeRef} data-zone="hand" className={`relative h-[28%] flex items-center justify-center gap-1 px-4 py-2 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/60 ${highlight}`}>
      <span className="absolute top-1 left-3 text-dc-muted text-xs pointer-events-none">Main ({hand.length})</span>
      {hand.map((card) => (
        // La carte peut rétrécir (minWidth) pour se chevaucher quand la main est pleine.
        <Draggable key={card.id} {...cardProps(card.id, 'hand', handlers)} className="h-[90%] hover:-translate-y-2 transition-transform" style={{ flex: '0 1 auto', minWidth: 24 }}>
          <GameCard card={card} catalog={catalog} lang={lang} className="h-full" />
        </Draggable>
      ))}
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
 * Pile latérale. Bibliothèque : dos de carte seulement ; `libraryTop` est l'identifiant de la carte du dessus,
 * connu du mode test local pour pouvoir la glisser.
 */
export function ZonePile({ zone, view, catalog, lang, handlers, libraryTop, onPileClick, onPileContextMenu }: ZoneProps & {
  zone: 'command' | 'library' | 'graveyard' | 'exile'
  libraryTop?: string | null
  onPileClick?: () => void
  onPileContextMenu?: (e: React.MouseEvent) => void
}) {
  const { setNodeRef, highlight } = useZone(zone)
  const zones = view.players[view.me].zones
  const count = zone === 'library' ? zones.library.count : zones[zone].length
  // Commandement : toutes les cartes. Autres piles : la dernière carte arrivée est visible.
  const cards = zone === 'library' ? [] : zone === 'command' ? visible(zones.command) : visible(zones[zone]).slice(-1)
  const empty = zone === 'library' ? !libraryTop : cards.length === 0
  return (
    <div
      ref={setNodeRef}
      data-zone={zone}
      className={`relative rounded-xl border border-dc-border bg-dc-surface/60 p-2 flex flex-col items-center gap-1 min-h-0 ${highlight}`}
      onClick={onPileClick}
      onContextMenu={(e) => {
        if (!onPileContextMenu) return
        e.preventDefault()
        onPileContextMenu(e)
      }}
    >
      <span className="text-dc-muted text-xs">{PILE_LABELS[zone]} ({count})</span>
      <div className={`flex-1 min-h-0 w-full flex ${zone === 'command' ? 'gap-1' : ''} justify-center`}>
        {empty && <div className="aspect-[63/88] h-full rounded-[6%] border border-dashed border-dc-border" />}
        {zone === 'library' && libraryTop && (
          <Draggable {...cardProps(libraryTop, 'library', handlers)} className="h-full">
            <CardBack className="h-full" />
          </Draggable>
        )}
        {cards.map((card) => (
          <Draggable key={card.id} {...cardProps(card.id, zone, handlers)} className="h-full">
            <GameCard card={card} catalog={catalog} lang={lang} tax={zone === 'command' ? taxOf(view, card.id) : 0} className="h-full" />
          </Draggable>
        ))}
      </div>
    </div>
  )
}
