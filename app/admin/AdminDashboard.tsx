'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap } from 'lucide-react'
import { Match, Player } from '@/lib/leaderboard'
import { DbPlayoff } from '@/lib/db'
import type { DbLeague, DbLeaguePlayerWithName } from '@/lib/db-leagues'
import type { DbDeck } from '@/lib/db-decks'
import type { AccountStatus } from '@/lib/db-auth'
import AccountsPanel from '@/components/admin/AccountsPanel'
import LeagueHeader from '@/components/admin/LeagueHeader'
import ParticipantsPanel from '@/components/admin/ParticipantsPanel'
import PlayoffsPanel from '@/components/admin/PlayoffsPanel'
import RoundRobinPanel from '@/components/admin/RoundRobinPanel'
import { useAdminApi } from '@/components/admin/useAdminApi'
import { sendJson } from '@/components/formStyles'

interface Props {
  initialPlayers: Player[]
  initialMatches: Match[]
  initialPlayoffs: DbPlayoff[]
  allRRCompleted: boolean
  activeLeague: DbLeague | null
  leaguePlayers: DbLeaguePlayerWithName[]
  initialDecks: Record<string, DbDeck[]>
  playerIdsWithHistory: string[]
  accountStatuses: Record<string, AccountStatus>
  currentUserId: string | null
  isBootstrap: boolean
}

/**
 * Page admin : état partagé de la saison (joueurs, matchs, playoffs) et assemblage des panneaux.
 * Chaque panneau garde ses propres états d'affichage (confirmations, formulaires, chargements).
 */
export default function AdminDashboard({
  initialPlayers, initialMatches, initialPlayoffs, allRRCompleted,
  activeLeague, leaguePlayers: initialLeaguePlayers, initialDecks, playerIdsWithHistory,
  accountStatuses, currentUserId, isBootstrap,
}: Props) {
  const router = useRouter()
  const api = useAdminApi()
  const { toast, showToast, call } = api

  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [matches, setMatches] = useState<Match[]>(initialMatches)
  const [playoffs, setPlayoffs] = useState<DbPlayoff[]>(initialPlayoffs)
  const [playerDecks, setPlayerDecks] = useState<Record<string, DbDeck[]>>(initialDecks)

  const [league, setLeague] = useState<DbLeague | null>(activeLeague)
  const [leaguePlayers, setLeaguePlayers] = useState(initialLeaguePlayers)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [createLeagueLoading, setCreateLeagueLoading] = useState(false)

  const leagueStarted = matches.length > 0
  const enrolledCount = leaguePlayers.length
  const completedCount = matches.filter((m) => m.is_completed).length

  // Build player map
  const playerMap: Record<string, Player> = {}
  for (const p of players) playerMap[p.id] = p

  const canCloseLeague =
    allRRCompleted &&
    ((enrolledCount < 4 && playoffs.length === 0) ||
      (playoffs.length > 0 && playoffs.every((p) => p.is_completed)))

  async function handleResetMatches() {
    const { ok } = await call('/api/matches/generate', 'DELETE')
    if (!ok) return
    setMatches([])
    setPlayoffs([])
    showToast('Matchs et playoffs réinitialisés')
    router.refresh()
  }

  async function handleLogout() {
    const { error } = await sendJson('/api/auth/logout', 'POST')
    if (error) return showToast(`Déconnexion impossible : ${error}`)
    router.push('/')
    router.refresh()
  }

  /** Recharge la liste des joueurs ; en cas d'échec, garde l'ancienne et renvoie de quoi compléter le toast. */
  async function reloadPlayers(): Promise<string> {
    const { error, data } = await sendJson('/api/players', 'GET')
    if (error) return ` (liste des joueurs non rechargée : ${error})`
    setPlayers(data as Player[])
    return ''
  }

  async function handleCreateLeague(e: React.FormEvent) {
    e.preventDefault()
    if (!newLeagueName.trim()) return
    setCreateLeagueLoading(true)
    try {
      const { ok, data } = await call<DbLeague>('/api/leagues', 'POST', { name: newLeagueName.trim() })
      if (!ok) return
      const created = data as DbLeague
      const warning = await reloadPlayers()
      setLeague(created)
      setLeaguePlayers([])
      setNewLeagueName('')
      showToast(`Saison "${created.name}" créée !${warning}`)
      router.refresh()
    } finally {
      setCreateLeagueLoading(false)
    }
  }

  async function handleDeleteLeague() {
    if (!league) return
    const { ok } = await call(`/api/leagues/${league.id}`, 'DELETE')
    if (!ok) return
    const warning = await reloadPlayers()
    setLeague(null)
    setLeaguePlayers([])
    setMatches([])
    setPlayoffs([])
    showToast(`Saison supprimée${warning}`)
    router.refresh()
  }

  async function handleCloseLeague() {
    if (!league) return
    const { ok, data } = await call<DbLeague>(`/api/leagues/${league.id}/close`, 'POST')
    if (!ok) return
    setLeague(null)
    setMatches([])
    setPlayoffs([])
    setPlayers([])
    showToast(`Saison "${(data as DbLeague).name}" archivée !`)
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {/* Toast */}
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
        onResetMatches={handleResetMatches}
        onCloseLeague={handleCloseLeague}
        onDeleteLeague={handleDeleteLeague}
        onLogout={handleLogout}
      />

      {/* No active league — create one */}
      {!league && (
        <div className="bg-dc-surface border border-dc-gold/20 rounded-2xl p-5 space-y-4">
          <h2 className="font-fantasy font-bold text-dc-gold flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Nouvelle saison
          </h2>
          <p className="text-dc-muted text-sm">Aucune saison active. Créez-en une pour commencer.</p>
          <form onSubmit={handleCreateLeague} className="flex gap-3">
            <input
              type="text"
              value={newLeagueName}
              onChange={(e) => setNewLeagueName(e.target.value)}
              placeholder="ex: Saison 1"
              className="flex-1 bg-dc-bg border border-dc-border rounded-xl px-4 py-2.5 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 transition-colors text-sm"
            />
            <button
              type="submit"
              disabled={!newLeagueName.trim() || createLeagueLoading}
              className="flex items-center gap-2 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            >
              {createLeagueLoading ? 'Création…' : 'Créer'}
            </button>
          </form>
        </div>
      )}

      {/* Section: Comptes joueurs */}
      <AccountsPanel
        players={players}
        statuses={accountStatuses}
        currentUserId={currentUserId}
        isBootstrap={isBootstrap}
        onToast={showToast}
      />

      {/* Section: Participants */}
      {league && !leagueStarted && (
        <ParticipantsPanel
          league={league}
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

      {/* Sections : génération de la ligue et matchs */}
      <RoundRobinPanel
        api={api}
        matches={matches}
        setMatches={setMatches}
        playerMap={playerMap}
        enrolledCount={enrolledCount}
        leagueStarted={leagueStarted}
        canGenerate={Boolean(league) && !leagueStarted && enrolledCount >= 2}
      />

      {/* Section : playoffs */}
      {leagueStarted && (allRRCompleted || playoffs.length > 0) && (
        <PlayoffsPanel
          api={api}
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
