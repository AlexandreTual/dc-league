'use client'

import { useDraggable } from '@dnd-kit/core'
import type { ZoneRef } from '@/lib/game/types'
import { longPressClass, menuGesture, type MenuPoint } from './touch'

/** Enveloppe déplaçable : la carte d'origine s'estompe, l'aperçu suit le pointeur (DragOverlay). */
export default function Draggable({ id, from, disabled = false, highlight = false, selected = false, faded = false, children, className = '', style, onDoubleClick, onContextMenu, onHover, onSelectClick }: {
  id: string
  from: ZoneRef
  /** Spectateur, partie finie, carte d'un autre non déplaçable : pas de glisser. */
  disabled?: boolean
  /** Carte qui vient de changer (repère d'activité). */
  highlight?: boolean
  /** Carte de la sélection (liseré bleu). */
  selected?: boolean
  /** Carte emportée avec celle qu'on glisse (groupe sélectionné) : estompée comme elle. */
  faded?: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onDoubleClick?: () => void
  /** Menu de la carte : clic droit, ou appui long au doigt. */
  onContextMenu?: (at: MenuPoint) => void
  onHover?: (hovering: boolean) => void
  /** Maj + clic (ou Ctrl, Cmd) : ajoute la carte à la sélection ou l'en retire. */
  onSelectClick?: () => void
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id, data: { from }, disabled })
  const press = menuGesture(onContextMenu)
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...press}
      data-card-id={id}
      data-highlight={highlight || undefined}
      data-selected={selected || undefined}
      className={`${className} ${isDragging || faded ? 'opacity-30' : ''} ${disabled ? '' : 'cursor-grab active:cursor-grabbing'} touch-none ${longPressClass} ${highlight ? 'ring-2 ring-dc-gold rounded-[6%] transition-shadow' : ''} ${selected ? 'outline outline-2 outline-offset-2 outline-sky-400 rounded-[6%]' : ''}`}
      style={style}
      onClick={(e) => {
        if (onSelectClick && (e.shiftKey || e.ctrlKey || e.metaKey)) onSelectClick()
      }}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {children}
    </div>
  )
}
