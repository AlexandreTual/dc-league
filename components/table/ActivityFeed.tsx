'use client'

import { Dices } from 'lucide-react'

/** `roll` : lancer de dés (le mien compris), mis en valeur. */
export type ActivityLine = { key: number; author: string; text: string; roll?: boolean }

/** Lignes d'activité des autres joueurs et lancers de dés (temporaires), et dernier refus du moteur, en rouge. */
export default function ActivityFeed({ lines, error }: { lines: ActivityLine[]; error: string | null }) {
  if (lines.length === 0 && !error) return null
  return (
    <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1 w-max max-w-[90%] sm:max-w-[60%]" data-testid="activity">
      {lines.map((line) => (
        <div key={line.key} data-testid={line.roll ? 'activity-roll' : 'activity-line'}
          className={`px-3 py-1 rounded-lg bg-dc-surface/95 border text-dc-text shadow-card ${line.roll ? 'border-dc-gold text-base flex items-center gap-1.5 animate-[pulse_0.6s_ease-out_1]' : 'border-dc-gold/40 text-sm'}`}>
          {line.roll && <Dices className="w-4 h-4 text-dc-gold shrink-0" />}
          {line.author && <span className="text-dc-gold font-semibold mr-1.5">{line.author}</span>}
          {line.text}
        </div>
      ))}
      {error && (
        <div className="px-3 py-1 rounded-lg bg-dc-red/90 border border-dc-red-light text-sm text-white shadow-card" role="alert" data-testid="activity-error">
          {error}
        </div>
      )}
    </div>
  )
}
