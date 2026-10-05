'use client'

import { X } from 'lucide-react'
import type { PlayerView } from '@/lib/game/types'

/** Journal du mode test : un seul joueur, donc lignes affichées sans le nom de l'auteur. */
export default function LogPanel({ view, onClose }: { view: PlayerView; onClose: () => void }) {
  const me = view.players[view.me]
  const stats: [string, number][] = [
    ['Tour', view.turn],
    ['Cartes piochées', me.stats.drawn],
    ['Terrains joués', me.stats.landsPlayed],
    ['Mulligans', me.mulligans],
    ['Bibliothèque', me.zones.library.count],
  ]
  return (
    <aside className="absolute top-0 right-0 bottom-0 z-50 w-80 bg-dc-surface border-l border-dc-border flex flex-col shadow-card" aria-label="Journal">
      <div className="flex items-center px-4 py-3 border-b border-dc-border">
        <h2 className="font-fantasy text-dc-gold">Journal</h2>
        <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label="Fermer le journal"><X className="w-5 h-5" /></button>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 border-b border-dc-border text-sm">
        {stats.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-dc-muted">{label}</dt>
            <dd className="text-dc-text text-right">{value}</dd>
          </div>
        ))}
      </dl>
      <ol className="flex-1 overflow-y-auto px-4 py-3 space-y-1 text-sm" data-testid="log">
        {[...view.log].reverse().map((entry, i) => (
          <li key={view.log.length - i} className="text-dc-text">
            <span className="text-dc-muted mr-2">T{entry.turn}</span>{entry.text}
          </li>
        ))}
      </ol>
    </aside>
  )
}
