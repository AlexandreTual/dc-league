'use client'

import { useEffect, useMemo, useState } from 'react'
import { drawSequence } from '@/lib/game/first-player'
import type { PlayerView } from '@/lib/game/types'

/**
 * Lancement de partie : les noms défilent et s'arrêtent sur le premier joueur (tiré par le serveur, rien n'est
 * tiré ici), puis l'ordre du tour. Premier joueur choisi par l'hôte : pas de défilement, c'est indiqué.
 */
export default function StartDraw({ view, onClose }: { view: PlayerView; onClose: () => void }) {
  const order = view.turnOrder
  const first = order[0]
  const chosen = view.firstChosen === true
  // Défilement dans l'ordre des places (l'ordre du tour n'apparaît qu'à la fin).
  const steps = useMemo(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    return chosen || reduced ? [] : drawSequence(Object.keys(view.players), first)
  }, [chosen, first, view.players])
  const [step, setStep] = useState(0)
  const done = step >= steps.length

  useEffect(() => {
    if (done) return
    const timer = setTimeout(() => setStep((i) => i + 1), steps[step].delay)
    return () => clearTimeout(timer)
  }, [done, step, steps])

  const name = (id: string) => view.players[id]?.name ?? '?'
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={onClose} data-testid="start-draw">
      <div className="bg-dc-surface border border-dc-gold/40 rounded-2xl w-full max-w-sm p-6 text-center space-y-4 shadow-card"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Qui commence ?">
        <h2 className="font-fantasy text-dc-gold text-lg">Qui commence ?</h2>
        {!done ? (
          <p className="font-fantasy text-3xl text-dc-text py-4" aria-live="off" data-testid="start-draw-name">{name(steps[step].id)}</p>
        ) : (
          <>
            <p className="font-fantasy text-3xl text-dc-gold py-2" data-testid="start-draw-first">{name(first)}</p>
            <p className="text-sm text-dc-muted">{chosen ? "commence (choisi par l'hôte)" : 'commence (tirage au sort)'}</p>
            <ol className="text-left inline-block space-y-1 text-sm text-dc-text" data-testid="start-draw-order">
              {order.map((id, i) => (
                <li key={id} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border border-dc-gold/50 text-dc-gold text-xs flex items-center justify-center">{i + 1}</span>
                  {name(id)}{id === view.me && <span className="text-dc-muted">(moi)</span>}
                </li>
              ))}
            </ol>
            <div>
              <button className="px-5 py-2 rounded-lg bg-dc-gold/20 border border-dc-gold/40 text-dc-gold" onClick={onClose}>C&apos;est parti</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
