'use client'

import { useDraggable } from '@dnd-kit/core'
import type { PlayerZone } from '@/lib/game/types'

/** Enveloppe déplaçable : la carte d'origine s'estompe, l'aperçu suit le pointeur (DragOverlay). */
export default function Draggable({ id, from, children, className = '', style, onDoubleClick, onContextMenu, onHover }: {
  id: string
  from: PlayerZone
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onDoubleClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  onHover?: (hovering: boolean) => void
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id, data: { from } })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-card-id={id}
      className={`${className} ${isDragging ? 'opacity-30' : ''} cursor-grab active:cursor-grabbing touch-none`}
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
