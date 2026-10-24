'use client'

import { useDraggable } from '@dnd-kit/core'
import type { ZoneRef } from '@/lib/game/types'
import { isMenuKey } from './a11y'
import { longPressClass, menuGesture, type MenuPoint } from './touch'

/** Enveloppe déplaçable : la carte d'origine s'estompe, l'aperçu suit le pointeur (DragOverlay). */
export default function Draggable({ id, dragKey, label, from, disabled = false, highlight = false, selected = false, faded = false, touchScroll = false, children, className = '', style, onDoubleClick, onContextMenu, onHover, onSelectClick }: {
  id: string
  /**
   * Identifiant du glisser, s'il diffère de la carte : une même carte affichée deux fois (vignette Cim. et liste,
   * fenêtre d'une pile) ne doit pas avoir deux glissables du même identifiant, l'un efface l'inscription de l'autre.
   */
  dragKey?: string
  /** Nom lu par les lecteurs d'écran (nom de la carte, ou « Carte face cachée »). */
  label?: string
  from: ZoneRef
  /** Spectateur, partie finie, carte d'un autre non déplaçable : pas de glisser. */
  disabled?: boolean
  /** Carte qui vient de changer (repère d'activité). */
  highlight?: boolean
  /** Carte de la sélection (liseré bleu). */
  selected?: boolean
  /** Carte emportée avec celle qu'on glisse (groupe sélectionné) : estompée comme elle. */
  faded?: boolean
  /** Dans une liste qui défile : un glissement vertical du doigt fait défiler (le glisser démarre après l'appui de 200 ms). */
  touchScroll?: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onDoubleClick?: () => void
  /** Menu de la carte : clic droit, appui long au doigt, ou au clavier Entrée, Maj+F10, touche Menu. */
  onContextMenu?: (at: MenuPoint) => void
  onHover?: (hovering: boolean) => void
  /** Maj + clic (ou Ctrl, Cmd) : ajoute la carte à la sélection ou l'en retire. */
  onSelectClick?: () => void
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: dragKey ?? id, data: { from, card: id }, disabled, attributes: { roleDescription: 'carte' } })
  const press = menuGesture(onContextMenu)
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...press}
      aria-label={label}
      data-card-id={id}
      data-drag-key={dragKey ?? id}
      data-highlight={highlight || undefined}
      data-selected={selected || undefined}
      className={`${className} ${isDragging || faded ? 'opacity-30' : ''} ${disabled ? '' : 'cursor-grab active:cursor-grabbing'} ${touchScroll ? 'touch-pan-y' : 'touch-none'} ${longPressClass} ${highlight ? 'ring-2 ring-dc-gold rounded-[6%] transition-shadow' : ''} ${selected ? 'outline outline-2 outline-offset-2 outline-sky-400 rounded-[6%]' : ''}`}
      style={style}
      onClick={(e) => {
        if (onSelectClick && (e.shiftKey || e.ctrlKey || e.metaKey)) onSelectClick()
      }}
      onKeyDown={(e) => {
        // Au clavier, le menu s'ouvre au milieu de la carte qui a le focus.
        if (!onContextMenu || !isMenuKey(e)) return
        e.preventDefault()
        const box = e.currentTarget.getBoundingClientRect()
        onContextMenu({ clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 })
      }}
      onDoubleClick={onDoubleClick}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      {children}
    </div>
  )
}
