'use client'

import { useDroppable } from '@dnd-kit/core'
import type { Catalog, GameState, ZoneId } from '@/lib/game/types'
import Draggable from './Draggable'
import GameCard, { CardBack, type Lang } from './GameCard'

export type CardHandlers = {
  onDoubleClick: (id: string, zone: ZoneId) => void
  onContextMenu: (id: string, zone: ZoneId, e: React.MouseEvent) => void
  onHover: (id: string | null) => void
}

type ZoneProps = { state: GameState; catalog: Catalog; lang: Lang; handlers: CardHandlers }

function useZone(zone: ZoneId) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })
  return { setNodeRef, highlight: isOver ? 'ring-2 ring-dc-gold/60' : '' }
}

function cardProps(id: string, zone: ZoneId, handlers: CardHandlers) {
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

export function Battlefield({ state, catalog, lang, handlers }: ZoneProps) {
  const { setNodeRef, highlight } = useZone('battlefield')
  return (
    <div ref={setNodeRef} data-zone="battlefield" className={`relative flex-1 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/40 ${highlight}`}>
      <span className="absolute top-2 left-3 text-dc-muted text-xs pointer-events-none">Champ de bataille</span>
      {state.zones.battlefield.map((id) => {
        const card = state.cards[id]
        return (
          <Draggable
            key={id}
            {...cardProps(id, 'battlefield', handlers)}
            className="absolute w-[7%] min-w-[72px]"
            style={{ left: `${card.x}%`, top: `${card.y}%`, transform: `translate(-50%, -50%) rotate(${card.tapped ? 90 : 0}deg)`, transition: 'transform 150ms' }}
          >
            <GameCard id={id} state={state} catalog={catalog} lang={lang} />
          </Draggable>
        )
      })}
    </div>
  )
}

export function Hand({ state, catalog, lang, handlers }: ZoneProps) {
  const { setNodeRef, highlight } = useZone('hand')
  return (
    <div ref={setNodeRef} data-zone="hand" className={`relative h-[28%] flex items-center justify-center gap-1 px-4 py-2 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/60 ${highlight}`}>
      <span className="absolute top-1 left-3 text-dc-muted text-xs pointer-events-none">Main ({state.zones.hand.length})</span>
      {state.zones.hand.map((id) => (
        // La carte peut rétrécir (minWidth) pour se chevaucher quand la main est pleine.
        <Draggable key={id} {...cardProps(id, 'hand', handlers)} className="h-[90%] hover:-translate-y-2 transition-transform" style={{ flex: '0 1 auto', minWidth: 24 }}>
          <GameCard id={id} state={state} catalog={catalog} lang={lang} className="h-full" />
        </Draggable>
      ))}
    </div>
  )
}

const PILE_LABELS: Record<ZoneId, string> = {
  command: 'Commandement',
  library: 'Bibliothèque',
  graveyard: 'Cimetière',
  exile: 'Exil',
  hand: 'Main',
  battlefield: 'Champ de bataille',
}

export function ZonePile({ zone, state, catalog, lang, handlers, onPileClick, onPileContextMenu }: ZoneProps & {
  zone: 'command' | 'library' | 'graveyard' | 'exile'
  onPileClick?: () => void
  onPileContextMenu?: (e: React.MouseEvent) => void
}) {
  const { setNodeRef, highlight } = useZone(zone)
  const ids = state.zones[zone]
  // Bibliothèque : on ne prend que le dessus (index 0). Autres piles : la dernière carte arrivée est visible.
  const shown = zone === 'command' ? ids : ids.length ? [zone === 'library' ? ids[0] : ids[ids.length - 1]] : []
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
      <span className="text-dc-muted text-xs">{PILE_LABELS[zone]} ({ids.length})</span>
      <div className={`flex-1 min-h-0 w-full flex ${zone === 'command' ? 'gap-1' : ''} justify-center`}>
        {shown.length === 0 && <div className="aspect-[63/88] h-full rounded-[6%] border border-dashed border-dc-border" />}
        {shown.map((id) => (
          <Draggable key={id} {...cardProps(id, zone, handlers)} className="h-full">
            {zone === 'library' ? <CardBack className="h-full" /> : <GameCard id={id} state={state} catalog={catalog} lang={lang} className="h-full" />}
          </Draggable>
        ))}
      </div>
    </div>
  )
}
