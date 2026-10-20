'use client'

import { useLayoutEffect, useRef } from 'react'
import { Crown, Flag } from 'lucide-react'
import { FLIGHT_MS, type Flight } from './usePlayerFx'

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Centre d'un élément à l'écran ; rien s'il n'est pas affiché. */
function centerOf(el: Element | null): { x: number; y: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/**
 * Une couronne (monarque) ou un drapeau (initiative) qui passe d'un joueur à l'autre : il s'envole du portrait de l'ancien
 * vers la pastille du nouveau, en arc ; de personne (ou ancien portrait absent) : il jaillit au-dessus du nouveau ;
 * à personne : il monte au-dessus de l'ancien et s'efface. Mouvement réduit : immobile sur le nouveau.
 */
function FlightIcon({ flight }: { flight: Flight }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const portrait = (player: string | null) => (player ? document.querySelector(`[data-portrait-of="${player}"]`) : null)
    const badge = flight.to ? document.querySelector(`[data-panel="${flight.to}"] [data-badge="${flight.kind}"]`) : null
    const from = centerOf(portrait(flight.from))
    const to = centerOf(badge) ?? centerOf(portrait(flight.to))
    const at = (p: { x: number; y: number }, dy = 0, scale = 1) => `translate(${p.x}px, ${p.y + dy}px) translate(-50%, -50%) scale(${scale})`
    let frames: Keyframe[]
    if (!to && !from) return
    if (reducedMotion()) {
      const p = (to ?? from)!
      frames = [{ transform: at(p), opacity: 1 }, { transform: at(p), opacity: 1, offset: 0.85 }, { transform: at(p), opacity: 0 }]
    } else if (from && to) {
      const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 70 }
      frames = [
        { transform: at(from, 0, 0.6), opacity: 0 },
        { transform: at(from, -10, 1.2), opacity: 1, offset: 0.15 },
        { transform: at(mid, 0, 1.6), opacity: 1, offset: 0.55 },
        { transform: at(to, 0, 1), opacity: 1, offset: 0.9 },
        { transform: at(to, 0, 0.8), opacity: 0 },
      ]
    } else if (to) {
      frames = [
        { transform: at(to, -10, 0), opacity: 0 },
        { transform: at(to, -30, 1.6), opacity: 1, offset: 0.35 },
        { transform: at(to, -20, 1.2), opacity: 1, offset: 0.75 },
        { transform: at(to, 0, 0.8), opacity: 0 },
      ]
    } else {
      frames = [{ transform: at(from!, 0, 1), opacity: 1 }, { transform: at(from!, -50, 1.3), opacity: 0 }]
    }
    const animation = el.animate(frames, { duration: FLIGHT_MS, easing: 'ease-in-out', fill: 'forwards' })
    // La pastille du nouveau n'apparaît qu'à l'arrivée de l'icône.
    const hold = badge instanceof HTMLElement && from && to && !reducedMotion()
      ? badge.animate([{ opacity: 0 }, { opacity: 0, offset: 0.85 }, { opacity: 1 }], { duration: FLIGHT_MS })
      : null
    return () => {
      animation.cancel()
      hold?.cancel()
    }
  }, [flight])
  const Icon = flight.kind === 'monarch' ? Crown : Flag
  return (
    <div ref={ref} className="fixed left-0 top-0 opacity-0 w-8 h-8 rounded-full bg-dc-gold text-dc-bg flex items-center justify-center shadow-gold"
      style={{ boxShadow: '0 0 0 2px #f0d080, 0 0 16px rgba(240, 208, 128, 0.8)' }} data-fx-flight={flight.kind}>
      <Icon className="w-4 h-4" />
    </div>
  )
}

/** Couronnes et drapeaux en vol, par-dessus la table (sans gêner les clics). */
export default function HolderFlights({ flights }: { flights: Flight[] }) {
  if (flights.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[45]" aria-hidden>
      {flights.map((f) => <FlightIcon key={f.key} flight={f} />)}
    </div>
  )
}
