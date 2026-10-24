'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Match, Player } from '@/lib/leaderboard'
import { DbPlayoff } from '@/lib/db'
import type { DbLeague, DbLeaguePlayerWithName } from '@/lib/db-leagues'
import type { DbDeck } from '@/lib/db-decks'
import LeagueHeader from '@/components/admin/LeagueHeader'
import ParticipantsPanel from '@/components/admin/ParticipantsPanel'
import PlayoffsPanel from '@/components/admin/PlayoffsPanel'
import RoundRobinPanel from '@/components/admin/RoundRobinPanel'
import { useAdminApi } from '@/components/admin/useAdminApi'
import InvitePanel from '@/components/leagues/InvitePanel'
import LeagueSettings from '@/components/leagues/LeagueSettings'
import { useT } from '@/components/i18n/I18nProvider'

interface Props {
  league: DbLeague
  isAdmin: boolean
  initialPlayers: Player[]
  initialMatches: Match[]
  initialPlayoffs: DbPlayoff[]
  allRRCompleted: boolean
  leaguePlayers: DbLeaguePlayerWithName[]
  initialDecks: Record<string, DbDeck[]>
  playerIdsWithHistory: string[]
  inviteToken: string | null
}

/**
 * Gestion d'une ligue par son organisateur (ou un admin) : état partagé (joueurs, matchs, playoffs)
 * et assemblage des panneaux. Chaque panneau garde ses propres états d'affichage.
 */
export default function ManageLeague({
  league, isAdmin, initialPlayers, initialMatches, initialPlayoffs, allRRCompleted,
  leaguePlayers: initialLeaguePlayers, initialDecks, playerIdsWithHistory, inviteToken,
}: Props) {
  const router = useRouter()
  const t = useT()
  const api = useAdminApi()
  const { toast, showToast, call } = api

  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [matches, setMatches] = useState<Match[]>(initialMatches)
  const [playoffs, setPlayoffs] = useState<DbPlayoff[]>(initialPlayoffs)
  const [playerDecks, setPlayerDecks] = useState<Record<string, DbDeck[]>>(initialDecks)
  const [leaguePlayers, setLeaguePlayers] = useState(initialLeaguePlayers)

  const leagueStarted = matches.length > 0
  const enrolledCount = leaguePlayers.length
  const completedCount = matches.filter((m) => m.is_completed).length
  const open = league.is_active

  const playerMap: Record<string, Player> = {}
  for (const p of players) playerMap[p.id] = p

  const canCloseLeague =
    allRRCompleted &&
    ((enrolledCount < 4 && playoffs.length === 0) ||
      (playoffs.length > 0 && playoffs.every((p) => p.is_completed)))

  async function handleResetMatches() {
    const { ok } = await call(`/api/leagues/${league.id}/matches`, 'DELETE')
    if (!ok) return
    setMatches([])
    setPlayoffs([])
    showToast(t.leagues.manage.reset)
    router.refresh()
  }

  async function handleDeleteLeague() {
    const { ok } = await call(`/api/leagues/${league.id}`, 'DELETE')
    if (!ok) return
    router.push('/ligues')
    router.refresh()
  }

  async function handleCloseLeague() {
    const { ok } = await call<DbLeague>(`/api/leagues/${league.id}/close`, 'POST')
    if (!ok) return
    showToast(t.leagues.manage.closed(league.name))
    router.push(`/ligues/${league.id}/classement`)
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div role="status" className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-max max-w-[calc(100vw-2rem)] text-center bg-dc-surface border border-dc-gold/40 text-dc-gold px-5 py-3 rounded-xl shadow-gold text-sm font-semibold animate-pulse">
          {toast}
        </div>
      )}

      <LeagueHeader
        league={league}
        enrolledCount={enrolledCount}
        matchCount={matches.length}
        completedCount={completedCount}
        canClose={canCloseLeague}
        canDelete={isAdmin || completedCount === 0}
        onResetMatches={handleResetMatches}
        onCloseLeague={handleCloseLeague}
        onDeleteLeague={handleDeleteLeague}
      />

      <LeagueSettings league={league} api={api} />

      {open && !leagueStarted && <InvitePanel leagueId={league.id} leagueName={league.name} initialToken={inviteToken} api={api} />}

      {open && !leagueStarted && (
        <ParticipantsPanel
          league={league}
          isAdmin={isAdmin}
          api={api}
          players={players}
          setPlayers={setPlayers}
          leaguePlayers={leaguePlayers}
          setLeaguePlayers={setLeaguePlayers}
          playerDecks={playerDecks}
          setPlayerDecks={setPlayerDecks}
          playerIdsWithHistory={playerIdsWithHistory}
        />
      )}

      <RoundRobinPanel
        api={api}
        leagueId={league.id}
        matches={matches}
        setMatches={setMatches}
        playerMap={playerMap}
        enrolledCount={enrolledCount}
        leagueStarted={leagueStarted}
        canGenerate={open && !leagueStarted && enrolledCount >= 2}
      />

      {leagueStarted && (allRRCompleted || playoffs.length > 0) && (
        <PlayoffsPanel
          api={api}
          leagueId={league.id}
          playoffs={playoffs}
          setPlayoffs={setPlayoffs}
          playerMap={playerMap}
          allRRCompleted={allRRCompleted}
          enrolledCount={enrolledCount}
        />
      )}
    </div>
  )
}
