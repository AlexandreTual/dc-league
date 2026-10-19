'use client'

// Rectangle de sélection tracé sur le fond d'une zone (mon champ de bataille, ma main).
// Souris : cliquer-glisser dans le vide. Doigt : appui long dans le vide, puis glisser.
import { useRef, useState } from 'react'
import { LONG_PRESS_MS, LONG_PRESS_TOLERANCE, type MenuPoint } from './touch'

export type Box = { left: number; top: number; width: number; height: number }

/** Déplacement de la souris au-delà duquel un clic dans le vide devient un rectangle. */
export const MOUSE_START = 5

/** Rectangle entre deux points, quel que soit le sens du tracé. */
export function boxBetween(a: { x: number; y: number }, b: { x: number; y: number }): Box {
  return { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
}

/** Le rectangle touche-t-il la carte (même d'un bord) ? */
export function overlaps(card: { left: number; top: number; right: number; bottom: number }, box: Box): boolean {
  return card.left <= box.left + box.width && card.right >= box.left && card.top <= box.top + box.height && card.bottom >= box.top
}

/** Le rectangle dans les coordonnées de la zone (pour l'afficher dedans). */
export function relativeTo(box: Box, zone: { left: number; top: number }): Box {
  return { ...box, left: box.left - zone.left, top: box.top - zone.top }
}

/** Le premier clic qui suit un appui long ne doit pas choisir une entrée du menu qui vient de s'ouvrir dessous. */
const CLICK_AFTER_LIFT_MS = 300
function swallowClick() {
  const swallow = (e: Event) => {
    e.stopPropagation()
    e.preventDefault()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, true), CLICK_AFTER_LIFT_MS)
}

/**
 * Tracé d'un rectangle de sélection sur le fond d'une zone. Les cartes (`data-card-id`) et les boutons gardent
 * leurs gestes. `onSelect` : cartes touchées par le rectangle ; `additive` : Maj, Ctrl ou Cmd tenu au départ.
 * `onClear` : simple clic (ou toucher) dans le vide. `onLongPress` : appui long au doigt relâché sans glisser
 * (menu de la zone).
 */
export function useLasso({ enabled, onSelect, onClear, onLongPress }: {
  enabled: boolean
  onSelect: (ids: string[], additive: boolean) => void
  onClear: () => void
  onLongPress?: (at: MenuPoint) => void
}) {
  const [box, setBox] = useState<Box | null>(null)
  const latest = useRef({ onSelect, onClear, onLongPress })
  latest.current = { onSelect, onClear, onLongPress }
  /** Un doigt est posé dans le vide de la zone (le menu natif d'Android est alors ignoré). */
  const touching = useRef(false)

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!enabled || !e.isPrimary) return
    const mouse = e.pointerType === 'mouse'
    if (mouse && e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-card-id], button, input, a, [role="menu"]')) return
    const zone = e.currentTarget
    const pointer = e.pointerId
    const origin = { x: e.clientX, y: e.clientY }
    const additive = e.shiftKey || e.ctrlKey || e.metaKey
    // Au doigt, le tracé n'est permis qu'après l'appui long : un glisser plus tôt reste un geste ordinaire.
    let armed = mouse
    let drawing = false
    touching.current = !mouse
    const timer = mouse ? null : setTimeout(() => {
      armed = true
      navigator.vibrate?.(10)
    }, LONG_PRESS_MS)

    const stop = () => {
      if (timer) clearTimeout(timer)
      touching.current = false
      setBox(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return
      const distance = Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y)
      if (!armed) {
        if (distance > LONG_PRESS_TOLERANCE) stop()
        return
      }
      if (!drawing && distance > (mouse ? MOUSE_START : LONG_PRESS_TOLERANCE)) drawing = true
      if (drawing) setBox(relativeTo(boxBetween(origin, { x: ev.clientX, y: ev.clientY }), zone.getBoundingClientRect()))
    }
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointer) return
      const wasArmed = armed
      const wasDrawing = drawing
      stop()
      if (wasDrawing) {
        const area = boxBetween(origin, { x: ev.clientX, y: ev.clientY })
        const ids = [...zone.querySelectorAll<HTMLElement>('[data-card-id]')]
          .filter((el) => overlaps(el.getBoundingClientRect(), area))
          .map((el) => el.dataset.cardId!)
        latest.current.onSelect(ids, additive)
        if (!mouse) swallowClick()
      } else if (mouse || !wasArmed) {
        if (!additive) latest.current.onClear()
      } else if (latest.current.onLongPress) {
        swallowClick()
        latest.current.onLongPress({ clientX: origin.x, clientY: origin.y, touch: true })
      }
    }
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId === pointer) stop()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  return { onPointerDown, box, touching: () => touching.current }
}
