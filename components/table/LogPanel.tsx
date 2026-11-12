'use client'

import { X } from 'lucide-react'
import { useCardLang, useT } from '@/components/i18n/I18nProvider'
import { formatLog } from '@/lib/game/log-format'
import type { Catalog, PlayerView } from '@/lib/game/types'

/** Journal de la partie et mes statistiques (aucune pour un spectateur). */
export default function LogPanel({ view, catalogs, onClose }: { view: PlayerView; catalogs: Record<string, Catalog>; onClose: () => void }) {
  const t = useT()
  const [cardLang] = useCardLang()
  const me = view.players[view.me]
  // À plusieurs, chaque ligne porte le nom de son auteur (les lignes du serveur n'en ont pas).
  const author = (actor: string | null) => (Object.keys(view.players).length > 1 && actor ? view.players[actor]?.name : null)
  const labels = t.log.panel
  const stats: [string, number][] = me
    ? [
        [labels.turn, view.turn],
        [labels.drawn, me.stats.drawn],
        [labels.landsPlayed, me.stats.landsPlayed],
        [labels.mulligans, me.mulligans],
        [labels.library, me.zones.library.count],
      ]
    : [[labels.turn, view.turn]]
  return (
    <aside className="absolute top-0 right-0 bottom-0 z-50 w-80 bg-dc-surface border-l border-dc-border flex flex-col shadow-card" aria-label={labels.title}>
      <div className="flex items-center px-4 py-3 border-b border-dc-border">
        <h2 className="font-fantasy text-dc-gold">{labels.title}</h2>
        <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label={labels.close}><X className="w-5 h-5" /></button>
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
          <li key={(view.logStart ?? 0) + view.log.length - i} className="text-dc-text">
            <span className="text-dc-muted mr-2">{labels.turnShort(entry.turn)}</span>
            {author(entry.actor) && <span className="text-dc-gold mr-1.5" data-user-content>{author(entry.actor)}</span>}
            {formatLog(entry, t, cardLang, view, catalogs)}
          </li>
        ))}
      </ol>
    </aside>
  )
}
