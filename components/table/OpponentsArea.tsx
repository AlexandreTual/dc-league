'use client'

import { useState } from 'react'
import { Heart, LayoutGrid } from 'lucide-react'
import type { PlayerView } from '@/lib/game/types'

/**
 * Moitié haute de la table : les adversaires en bandeaux (vue « Tous ») ou l'un d'eux agrandi,
 * les autres en onglets. Un seul adversaire (Duel) : agrandi d'office.
 */
export default function OpponentsArea({ view, players, renderStrip, renderBoard }: {
  view: PlayerView
  players: string[]
  renderStrip: (player: string, focus: () => void) => React.ReactNode
  renderBoard: (player: string) => React.ReactNode
}) {
  const [focus, setFocus] = useState<string | null>(null)
  const focused = players.length === 1 ? players[0] : focus && players.includes(focus) ? focus : null

  if (focused) {
    return (
      <div className="h-full min-h-0 flex flex-col gap-1.5" data-opponents="focus">
        {players.length > 1 && (
          <div className="flex items-center gap-1.5" role="tablist">
            <button className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-dc-border text-dc-text hover:border-dc-gold/50" onClick={() => setFocus(null)}>
              <LayoutGrid className="w-3.5 h-3.5" /> Tous
            </button>
            {players.map((p) => (
              <button
                key={p}
                role="tab"
                aria-selected={p === focused}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border ${p === focused ? 'border-dc-gold/60 text-dc-gold' : 'border-dc-border text-dc-text'} ${view.activePlayer === p ? 'bg-dc-gold/10' : ''}`}
                onClick={() => setFocus(p)}
              >
                {view.players[p].name} <Heart className="w-3 h-3 text-dc-red-light" /> {view.players[p].life}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0">{renderBoard(focused)}</div>
      </div>
    )
  }

  const columns = players.length >= 3 ? 'grid-cols-2' : 'grid-cols-1'
  return (
    <div className={`h-full min-h-0 grid ${columns} auto-rows-fr gap-1.5`} data-opponents="all">
      {players.map((p) => <div key={p} className="min-h-0">{renderStrip(p, () => setFocus(p))}</div>)}
    </div>
  )
}
