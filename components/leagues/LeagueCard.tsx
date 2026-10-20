'use client'

import Link from 'next/link'
import { Lock, Trophy } from 'lucide-react'
import type { DbLeague } from '@/lib/db-leagues'
import { useI18n } from '@/components/i18n/I18nProvider'
import { organizerLabel, startedOrStatus } from './format'

/** Une ligue dans une liste ; `manage` mène à sa gestion (page d'administration). */
export default function LeagueCard({ league, manage = false }: { league: DbLeague; manage?: boolean }) {
  const { t, lang } = useI18n()
  return (
    <Link
      href={`/ligues/${league.id}/${manage ? 'gerer' : 'classement'}`}
      className="flex items-center justify-between gap-3 bg-dc-surface border border-dc-border rounded-xl p-4 hover:border-dc-gold/40 transition-all group"
    >
      <div className="min-w-0">
        <p data-user-content className="font-fantasy font-semibold text-dc-text group-hover:text-dc-gold transition-colors truncate">
          {league.name}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-dc-muted text-xs mt-0.5">
          <span>{organizerLabel(league, t)}</span>
          <span aria-hidden>·</span>
          <span>{startedOrStatus(league, t, lang)}</span>
          {league.visibility === 'private' && (
            <span className="inline-flex items-center gap-1"><Lock className="w-3 h-3" /> {t.leagues.private}</span>
          )}
        </p>
      </div>
      <Trophy className="w-4 h-4 shrink-0 text-dc-muted group-hover:text-dc-gold transition-colors" />
    </Link>
  )
}
