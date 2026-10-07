'use client'

import { Minus, Plus, X } from 'lucide-react'
import { DICE_SIDES, MAX_DICE } from '@/lib/game/dice'

const stepButton = 'w-9 h-9 flex items-center justify-center rounded-lg border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40'

/** Lancer de dés : nombre de dés (pas pour la pièce), puis le dé choisi ; le résultat s'affiche sur la table et au journal. */
export default function DiceModal({ count, onCount, onRoll, onClose }: {
  count: number
  onCount: (count: number) => void
  onRoll: (sides: number, count: number) => void
  onClose: () => void
}) {
  const roll = (sides: number) => {
    onRoll(sides, sides === 2 ? 1 : count)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-[55] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Lancer les dés">
        <div className="flex items-center px-4 py-3 border-b border-dc-border">
          <h2 className="font-fantasy text-dc-gold">Lancer les dés</h2>
          <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm text-dc-muted">Nombre de dés</span>
            <div className="ml-auto flex items-center gap-2">
              <button className={stepButton} onClick={() => onCount(count - 1)} disabled={count <= 1} aria-label="Un dé de moins"><Minus className="w-4 h-4" /></button>
              <span className="w-6 text-center text-lg text-dc-text" data-testid="dice-count">{count}</span>
              <button className={stepButton} onClick={() => onCount(count + 1)} disabled={count >= MAX_DICE} aria-label="Un dé de plus"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {DICE_SIDES.filter((s) => s !== 2).map((sides) => (
              <button key={sides} onClick={() => roll(sides)} data-testid={`roll-d${sides}`}
                className="py-3 rounded-lg border border-dc-border text-dc-text hover:border-dc-gold/50 font-semibold">
                {count > 1 ? `${count}d${sides}` : `d${sides}`}
              </button>
            ))}
          </div>
          <button onClick={() => roll(2)} data-testid="roll-coin"
            className="w-full py-3 rounded-lg border border-dc-border text-dc-text hover:border-dc-gold/50">
            Pile ou face
          </button>
        </div>
      </div>
    </div>
  )
}
