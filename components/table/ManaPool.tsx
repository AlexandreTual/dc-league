'use client'

import { useEffect, useState } from 'react'
import { Minus } from 'lucide-react'
import type { ClientAction } from '@/lib/game/room'
import { MANA_COLORS, type ManaColor, type ManaPool as Pool } from '@/lib/game/types'

const COLORS: Record<ManaColor, { name: string; className: string }> = {
  W: { name: 'Blanc', className: 'bg-[#f3ead0] text-black' },
  U: { name: 'Bleu', className: 'bg-[#2f7fd8] text-white' },
  B: { name: 'Noir', className: 'bg-[#3a3340] text-white border border-white/30' },
  R: { name: 'Rouge', className: 'bg-[#d8432f] text-white' },
  G: { name: 'Vert', className: 'bg-[#2f9e4f] text-white' },
  C: { name: 'Incolore', className: 'bg-[#a8a29e] text-black' },
}

function ManaSymbol({ color, small = false }: { color: ManaColor; small?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold ${small ? 'w-3.5 h-3.5 text-[8px]' : 'w-5 h-5 text-[10px]'} ${COLORS[color].className}`}>
      {color}
    </span>
  )
}

/**
 * Réserve de mana d'un joueur : pastilles des couleurs non nulles, visibles de tous.
 * Pour sa propre réserve, un clic ouvre le détail : + (Maj : +5), − ou clic droit, Vider, et l'option de garde.
 */
export default function ManaPool({ pool, keep = false, editable, send, openUp = false, alignRight = false }: {
  /** Absente quand le serveur de jeu n'a pas encore la réserve de mana (déployé avant elle) : rien n'est affiché. */
  pool: Pool | undefined
  keep: boolean | undefined
  editable: boolean
  send: (action: ClientAction) => void
  /** Ouvrir le détail vers le haut (réserve placée en bas de l'écran). */
  openUp?: boolean
  /** Aligner le détail sur le bord droit (réserve placée à droite de l'écran). */
  alignRight?: boolean
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  if (!pool) return null
  const total = MANA_COLORS.reduce((n, c) => n + pool[c], 0)
  const filled = MANA_COLORS.filter((c) => pool[c] > 0)
  const add = (color: ManaColor, delta: number) => send({ type: 'mana', color, delta })

  const summary = (
    <span className="inline-flex items-center gap-1" data-testid="mana-pool">
      {filled.length === 0
        ? <span className="text-dc-muted">Mana : 0</span>
        : filled.map((c) => (
          <span key={c} className="inline-flex items-center gap-0.5" title={`${COLORS[c].name} : ${pool[c]}`} data-mana={c}>
            <ManaSymbol color={c} small /> {pool[c]}
          </span>
        ))}
      {keep && <span className="text-dc-muted" title="Réserve gardée au changement de tour">⟳</span>}
    </span>
  )
  if (!editable) return summary

  return (
    <span className="relative inline-flex">
      <button className="inline-flex items-center gap-1 rounded px-1 hover:bg-dc-border tablet:min-h-11" onClick={() => setOpen((o) => !o)} aria-label="Réserve de mana" aria-expanded={open}>
        {summary}
      </button>
      {open && (
        <>
          <span className="fixed inset-0 z-[57]" onClick={() => setOpen(false)} />
          <div
            className={`absolute ${alignRight ? 'right-0' : 'left-0'} ${openUp ? 'bottom-full mb-1' : 'top-full mt-1'} z-[58] w-60 phone:fixed phone:inset-x-2 phone:top-[60px] phone:w-auto rounded-xl border border-dc-border bg-dc-surface p-3 space-y-2 shadow-card text-xs text-dc-text`}
            role="dialog" aria-label="Réserve de mana"
          >
            <div className="grid grid-cols-3 gap-1.5">
              {MANA_COLORS.map((c) => (
                <div key={c} className="flex items-center gap-1" data-mana-color={c}>
                  <button
                    className="rounded-full hover:ring-2 hover:ring-dc-gold/60"
                    onClick={(e) => add(c, e.shiftKey ? 5 : 1)}
                    onContextMenu={(e) => { e.preventDefault(); add(c, -1) }}
                    aria-label={`${COLORS[c].name} plus`}
                    title={`${COLORS[c].name} : clic +1, Maj +5, clic droit −1`}
                  >
                    <ManaSymbol color={c} />
                  </button>
                  <span className="min-w-[1.25rem] text-center">{pool[c]}</span>
                  <button className="p-0.5 rounded hover:bg-dc-border disabled:opacity-30" disabled={pool[c] === 0} onClick={() => add(c, -1)} aria-label={`${COLORS[c].name} moins`}>
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span>Total : <span className="font-semibold">{total}</span></span>
              <button className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dc-border hover:border-dc-gold/50 disabled:opacity-40" disabled={total === 0} onClick={() => send({ type: 'clearMana' })}>
                Vider
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-dc-muted">
              <input type="checkbox" checked={keep} onChange={() => send({ type: 'toggleKeepMana' })} />
              Garder ma réserve au changement de tour
            </label>
          </div>
        </>
      )}
    </span>
  )
}
