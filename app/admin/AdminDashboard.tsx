'use client'

import { Shield, Trophy } from 'lucide-react'
import type { Player } from '@/lib/leaderboard'
import type { DbLeague } from '@/lib/db-leagues'
import type { AccountStatus } from '@/lib/db-auth'
import AccountsPanel from '@/components/admin/AccountsPanel'
import { useAdminApi } from '@/components/admin/useAdminApi'
import LeagueCard from '@/components/leagues/LeagueCard'
import AiSettingsPanel from '@/components/admin/AiSettingsPanel'
import type { AiAdminStatus } from '@/lib/ai/admin'
import GamesPanel from '@/components/admin/GamesPanel'
import type { GameTable } from '@/lib/db-games'
import { useT } from '@/components/i18n/I18nProvider'

interface Props {
  players: Player[]
  accountStatuses: Record<string, AccountStatus>
  leagues: DbLeague[]
  ai: AiAdminStatus
  tables: GameTable[]
  currentUserId: string | null
  isBootstrap: boolean
}

/** Administration du site : comptes et invitations, gestion de toutes les ligues, parties en cours, assistant IA. */
export default function AdminDashboard({ players, accountStatuses, leagues, ai, tables, currentUserId, isBootstrap }: Props) {
  const { toast, showToast, call } = useAdminApi()
  const t = useT().admin.dashboard

  return (
    <div className="space-y-8">
      {toast && (
        <div role="status" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-max max-w-[calc(100vw-2rem)] text-center bg-dc-surface border border-dc-gold/40 text-dc-gold px-5 py-3 rounded-xl shadow-gold text-sm font-semibold animate-pulse">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-dc-gold/10 border border-dc-gold/30 flex items-center justify-center">
          <Shield className="w-5 h-5 text-dc-gold" />
        </div>
        <h1 className="font-fantasy text-2xl font-bold text-dc-gold">{t.title}</h1>
      </div>

      <AccountsPanel
        players={players}
        statuses={accountStatuses}
        currentUserId={currentUserId}
        isBootstrap={isBootstrap}
        onToast={showToast}
      />

      <section className="space-y-3" aria-labelledby="toutes-ligues">
        <h2 id="toutes-ligues" className="font-fantasy font-bold text-dc-text flex items-center gap-2">
          <Trophy className="w-5 h-5 text-dc-gold" /> {t.allLeagues(leagues.length)}
        </h2>
        <p className="text-dc-muted text-sm">
          {t.allLeaguesHelp}
        </p>
        {leagues.length === 0 ? (
          <p className="text-dc-muted text-sm">{t.noLeague}</p>
        ) : (
          <div className="space-y-2">{leagues.map((l) => <LeagueCard key={l.id} league={l} manage />)}</div>
        )}
      </section>

      <GamesPanel initial={tables} call={call} onToast={showToast} />

      <AiSettingsPanel initial={ai} onToast={showToast} />
    </div>
  )
}
