'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { menuPosition, touchTarget } from './touch'

export type MenuItem =
  | { kind: 'action'; label: string; onSelect: () => void }
  | { kind: 'stepper'; label: string; value: number | string; onChange: (delta: number) => void }
  | { kind: 'separator' }
  | { kind: 'title'; label: string }

/**
 * Menu contextuel positionné au pointeur, gardé dans l'écran (jamais au-dessus du bord haut, défilement
 * interne s'il est plus haut que l'écran), fermé au clic extérieur ou par Échap.
 */
export default function CardMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight?: number }>({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // scrollHeight : hauteur complète du contenu, même quand le menu est déjà borné.
    const size = { width: el.offsetWidth, height: el.scrollHeight }
    setPos(menuPosition({ x, y }, size, { width: window.innerWidth, height: window.innerHeight }))
  }, [x, y])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-[60] w-60 max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain bg-dc-surface border border-dc-border rounded-xl shadow-card p-1 text-sm"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.kind === 'separator') return <div key={i} className="my-1 border-t border-dc-border" />
        if (item.kind === 'title') return <div key={i} className="px-3 py-1 text-xs text-dc-muted">{item.label}</div>
        if (item.kind === 'stepper') {
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-1 text-dc-text">
              <span className="flex-1">{item.label}</span>
              <button className={`p-1 rounded hover:bg-dc-border ${touchTarget}`} onClick={() => item.onChange(-1)} aria-label={`${item.label} moins`}><Minus className="w-3 h-3" /></button>
              <span className="w-6 text-center">{item.value}</span>
              <button className={`p-1 rounded hover:bg-dc-border ${touchTarget}`} onClick={() => item.onChange(1)} aria-label={`${item.label} plus`}><Plus className="w-3 h-3" /></button>
            </div>
          )
        }
        return (
          <button
            key={i}
            role="menuitem"
            className="w-full text-left px-3 py-1.5 [@media(pointer:coarse)]:min-h-8 rounded-lg text-dc-text hover:bg-dc-border/70"
            onClick={() => {
              item.onSelect()
              onClose()
            }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
