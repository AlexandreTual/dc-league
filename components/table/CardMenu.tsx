'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { cardSrcSet } from '@/lib/cards/images'
import type { CardPreview } from '@/lib/game/card-preview'
import { menuPosition, touchTarget } from './touch'

export type MenuItem =
  | { kind: 'action'; label: string; onSelect: () => void }
  | { kind: 'stepper'; label: string; value: number | string; onChange: (delta: number) => void; onSet?: (value: number) => void; signed?: boolean }
  | { kind: 'separator' }
  | { kind: 'title'; label: string }

/** Largeur de l'image d'une carte dans son menu (au doigt). */
const PREVIEW_PX = 224

/**
 * Menu contextuel positionné au pointeur, gardé dans l'écran (jamais au-dessus du bord haut, défilement
 * interne s'il est plus haut que l'écran), fermé au clic extérieur ou par Échap.
 * `preview` (appui long au doigt) : grande image de la carte à gauche des entrées (au-dessus si la largeur
 * manque) et bouton « Fermer ».
 */
export default function CardMenu({ x, y, items, preview, onClose }: {
  x: number
  y: number
  items: MenuItem[]
  preview?: CardPreview | null
  onClose: () => void
}) {
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
      if (!ref.current || ref.current.contains(e.target as Node)) return
      // Un nombre en cours de saisie est appliqué avant la fermeture (le menu disparaît avant le blur).
      const active = document.activeElement
      if (active instanceof HTMLElement && ref.current.contains(active)) active.blur()
      onClose()
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
      className={`fixed z-[60] ${preview ? 'w-max flex flex-wrap gap-2' : 'w-60'} max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain bg-dc-surface border border-dc-border rounded-xl shadow-card p-1 text-sm`}
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.image} srcSet={cardSrcSet(preview.image, preview.imageLarge)} sizes={`${PREVIEW_PX}px`} alt={preview.name}
          // Hauteur fixée (format d'une carte) : le menu est placé avant le chargement de l'image.
          className="rounded-xl shadow-card shrink-0 aspect-[63/88] object-cover" style={{ width: PREVIEW_PX }} data-testid="menu-preview" />
      )}
      {preview ? (
        <div className="w-60 flex flex-col">
          <button className="self-end h-11 px-3 flex items-center gap-1.5 rounded-lg border border-dc-border text-dc-text hover:border-dc-gold/50" onClick={onClose}>
            <X className="w-4 h-4" /> Fermer
          </button>
          {menuItems(items, onClose)}
        </div>
      ) : menuItems(items, onClose)}
    </div>
  )
}

function menuItems(items: MenuItem[], onClose: () => void) {
  return (
    <>
      {items.map((item, i) => {
        if (item.kind === 'separator') return <div key={i} className="my-1 border-t border-dc-border" />
        if (item.kind === 'title') return <div key={i} className="px-3 py-1 text-xs text-dc-muted">{item.label}</div>
        if (item.kind === 'stepper') {
          return (
            <div key={i} className="flex items-center gap-2 px-3 py-1 text-dc-text">
              <span className="flex-1">{item.label}</span>
              <button className={`p-1 rounded hover:bg-dc-border ${touchTarget}`} onClick={() => item.onChange(-1)} aria-label={`${item.label} moins`}><Minus className="w-3 h-3" /></button>
              {item.onSet
                ? <NumberField key={`${item.label}:${item.value}`} label={item.label} value={item.value} onSet={item.onSet} signed={item.signed} />
                : <span className="w-6 text-center">{item.value}</span>}
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
    </>
  )
}

/**
 * Valeur d'un compteur modifiable au clavier : sélectionnée au focus, appliquée par Entrée ou en quittant
 * le champ, annulée par Échap (qui ferme le menu). Pavé numérique sur téléphone ; `signed` : signe moins
 * accepté (force, endurance), avec un clavier qui l'offre.
 */
function NumberField({ label, value, onSet, signed = false }: { label: string; value: number | string; onSet: (value: number) => void; signed?: boolean }) {
  const [draft, setDraft] = useState(String(value))
  const commit = () => {
    const n = Number.parseInt(draft, 10)
    if (Number.isFinite(n) && String(n) !== String(value)) onSet(n)
    else setDraft(String(value))
  }
  return (
    <input
      type="text"
      inputMode={signed ? 'text' : 'numeric'}
      pattern={signed ? undefined : '[0-9]*'}
      aria-label={`${label} : nombre`}
      className="w-9 rounded bg-dc-bg border border-dc-border text-center text-dc-text focus:outline-none focus:border-dc-gold [@media(pointer:coarse)]:min-h-8"
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(signed ? signedDraft(e.target.value) : e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** Saisie d'une valeur signée : un signe moins en tête au plus, puis trois chiffres. */
function signedDraft(text: string): string {
  const sign = /^\s*[-−]/.test(text) ? '-' : ''
  return sign + text.replace(/[^0-9]/g, '').slice(0, 3)
}
