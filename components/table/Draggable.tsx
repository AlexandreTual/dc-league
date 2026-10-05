'use client'

import { useDraggable } from '@dnd-kit/core'
import type { ZoneRef } from '@/lib/game/types'

/** Enveloppe déplaçable : la carte d'origine s'estompe, l'aperçu suit le pointeur (DragOverlay). */
export default function Draggable({ id, from, disabled = false, highlight = false, children, className = '', style, onDoubleClick, onContextMenu, onHover }: {
  id: string
  from: ZoneRef
  /** Spectateur, partie finie, carte d'un autre non déplaçable : pas de glisser. */
  disabled?: boolean
  /** Carte qui vient de changer (repère d'activité). */
  highlight?: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onDoubleClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onHover?: (hovering: boolean) => void
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id, data: { from }, disabled })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-card-id={id}
      data-highlight={highlight || undefined}
      className={`${className} ${isDragging ? 'opacity-30' : ''} ${disabled ? '' : 'cursor-grab active:cursor-grabbing'} touch-none ${highlight ? 'ring-2 ring-dc-gold rounded-[6%] transition-shadow' : ''}`}
      style={style}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {children}
    </div>
  )
}
