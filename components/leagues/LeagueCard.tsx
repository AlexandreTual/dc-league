import Link from 'next/link'
import { Lock, Trophy } from 'lucide-react'
import type { DbLeague } from '@/lib/db-leagues'
import { formatDate, organizerLabel, statusLabel } from './format'

/** Une ligue dans une liste ; `manage` mène à sa gestion (page d'administration). */
export default function LeagueCard({ league, manage = false }: { league: DbLeague; manage?: boolean }) {
  return (
    <Link
      href={`/ligues/${league.id}/${manage ? 'gerer' : 'classement'}`}
      className="flex items-center justify-between gap-3 bg-dc-surface border border-dc-border rounded-xl p-4 hover:border-dc-gold/40 transition-all group"
    >
      <div className="min-w-0">
        <p className="font-fantasy font-semibold text-dc-text group-hover:text-dc-gold transition-colors truncate">
          {league.name}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-dc-muted text-xs mt-0.5">
          <span>{organizerLabel(league)}</span>
          <span aria-hidden>·</span>
          <span>{league.is_active ? `Depuis le ${formatDate(league.started_at)}` : statusLabel(league)}</span>
          {league.visibility === 'private' && (
            <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Privée</span>
          )}
        </p>
      </div>
      <Trophy className="w-4 h-4 shrink-0 text-dc-muted group-hover:text-dc-gold transition-colors" />
    </Link>
  )
}
