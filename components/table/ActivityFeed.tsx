'use client'

export type ActivityLine = { key: number; author: string; text: string }

/** Lignes d'activité des autres joueurs (temporaires) et dernier refus du moteur, en rouge. */
export default function ActivityFeed({ lines, error }: { lines: ActivityLine[]; error: string | null }) {
  if (lines.length === 0 && !error) return null
  return (
    <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-1 max-w-[60%]" data-testid="activity">
      {lines.map((line) => (
        <div key={line.key} className="px-3 py-1 rounded-lg bg-dc-surface/95 border border-dc-gold/40 text-sm text-dc-text shadow-card" data-testid="activity-line">
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
