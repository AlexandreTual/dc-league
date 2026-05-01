'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Match, Player } from '@/lib/leaderboard'
import { DbPlayoff, DbPlayer } from '@/lib/db'
import type { DbLeague, DbLeaguePlayerWithName } from '@/lib/db-leagues'
import type { DbDeck } from '@/lib/db-decks'
import MatchCard from '@/components/MatchCard'
import ScoreModal from '@/components/ScoreModal'
import {
  Shield,
  UserPlus,
  Users,
  Plus,
  X,
  Zap,
  LogOut,
  Trash2,
  AlertTriangle,
  RefreshCcw,
  Trophy,
  Award,
  Archive,
} from 'lucide-react'

interface Props {
  initialPlayers: Player[]
  initialMatches: Match[]
  initialPlayoffs: DbPlayoff[]
  allRRCompleted: boolean
  activeLeague: DbLeague | null
  leaguePlayers: DbLeaguePlayerWithName[]
  initialDecks: Record<string, DbDeck[]>
  playerIdsWithHistory: string[]
}

export default function AdminDashboard({
  initialPlayers, initialMatches, initialPlayoffs, allRRCompleted,
  activeLeague, leaguePlayers: initialLeaguePlayers, initialDecks, playerIdsWithHistory,
}: Props) {
  const router = useRouter()

  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [matches, setMatches] = useState<Match[]>(initialMatches)
  const [playoffs, setPlayoffs] = useState<DbPlayoff[]>(initialPlayoffs)

  const [playerDecks, setPlayerDecks] = useState<Record<string, DbDeck[]>>(initialDecks)
  const [creatingDeckForPlayerId, setCreatingDeckForPlayerId] = useState<string | null>(null)
  const [newDeckName, setNewDeckName] = useState('')
  const [newDeckImage, setNewDeckImage] = useState('')
  const [newDeckMoxfield, setNewDeckMoxfield] = useState('')
  const [deckLoading, setDeckLoading] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [addPlayerLoading, setAddPlayerLoading] = useState(false)
  const [addPlayerError, setAddPlayerError] = useState('')
  const [showNewPlayerDeck, setShowNewPlayerDeck] = useState(false)
  const [newPlayerDeckName, setNewPlayerDeckName] = useState('')
  const [newPlayerDeckImage, setNewPlayerDeckImage] = useState('')
  const [newPlayerDeckMoxfield, setNewPlayerDeckMoxfield] = useState('')

  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [playoffLoading, setPlayoffLoading] = useState(false)
  const [playoffError, setPlayoffError] = useState('')
  const [confirmResetLeague, setConfirmResetLeague] = useState(false)
  const [confirmResetPlayoffs, setConfirmResetPlayoffs] = useState(false)

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [selectedPlayoff, setSelectedPlayoff] = useState<DbPlayoff | null>(null)
  const [toast, setToast] = useState('')

  const [league, setLeague] = useState<DbLeague | null>(activeLeague)
  const [leaguePlayers, setLeaguePlayers] = useState(initialLeaguePlayers)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [createLeagueLoading, setCreateLeagueLoading] = useState(false)
  const [closeLoading, setCloseLoading] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const leagueStarted = matches.length > 0

  const enrolledIds = new Set(leaguePlayers.map((lp) => lp.player_id))
  const enrolledCount = leaguePlayers.length
  const historySet = new Set(playerIdsWithHistory)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Build player map
  const playerMap: Record<string, Player> = {}
  for (const p of players) playerMap[p.id] = p

  async function handleToggleEnroll(player: Player, isEnrolled: boolean) {
    if (!league) return
    if (isEnrolled) {
      const res = await fetch(`/api/leagues/${league.id}/players/${player.id}`, { method: 'DELETE' })
      if (res.ok) {
        setLeaguePlayers((prev) => prev.filter((lp) => lp.player_id !== player.id))
        showToast(`${player.name} désinscrit`)
      } else {
        const data = await res.json()
        showToast(`Erreur : ${data.error}`)
      }
    } else {
      const res = await fetch(`/api/leagues/${league.id}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: player.id }),
      })
      if (res.ok) {
        const lp = await res.json()
        setLeaguePlayers((prev) => [...prev, { ...lp, name: player.name, avatar_url: (player as unknown as { avatar_url?: string | null }).avatar_url ?? null, deck_name: null, deck_moxfield_url: null, deck_commander_image_url: null }])
        showToast(`${player.name} inscrit`)
      } else {
        const data = await res.json()
        showToast(`Erreur : ${data.error}`)
      }
    }
  }

  async function handleAssignDeck(playerId: string, deckId: string) {
    if (!league) return
    const res = await fetch(`/api/leagues/${league.id}/players/${playerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck_id: deckId || null }),
    })
    if (res.ok) {
      const deck = playerDecks[playerId]?.find((d) => d.id === deckId)
      setLeaguePlayers((prev) =>
        prev.map((lp) =>
          lp.player_id === playerId
            ? { ...lp, deck_id: deckId || null, deck_name: deck?.name ?? null, deck_moxfield_url: deck?.moxfield_url ?? null, deck_commander_image_url: deck?.commander_image_url ?? null }
            : lp
        )
      )
    } else {
      const data = await res.json()
      showToast(`Erreur : ${data.error}`)
    }
  }

  async function handleCreateDeck(e: React.FormEvent, playerId: string) {
    e.preventDefault()
    if (!newDeckName.trim() || !league) return
    setDeckLoading(true)
    try {
      const res = await fetch(`/api/players/${playerId}/decks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDeckName.trim(),
          commander_image_url: newDeckImage.trim() || null,
          moxfield_url: newDeckMoxfield.trim() || null,
        }),
      })
      const deck = await res.json()
      if (!res.ok) {
        showToast(`Erreur : ${deck.error}`)
        return
      }
      setPlayerDecks((prev) => ({ ...prev, [playerId]: [...(prev[playerId] ?? []), deck] }))
      await handleAssignDeck(playerId, deck.id)
      setNewDeckName('')
      setNewDeckImage('')
      setNewDeckMoxfield('')
      setCreatingDeckForPlayerId(null)
      showToast(`Deck "${deck.name}" créé !`)
    } finally {
      setDeckLoading(false)
    }
  }

  async function handleAddNewPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newPlayerName.trim()) return
    setAddPlayerLoading(true)
    setAddPlayerError('')
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPlayerName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setAddPlayerError(data.error)
        return
      }

      setPlayers((prev) => [...prev, data])

      let newLp = {
        league_id: league?.id ?? '',
        player_id: data.id,
        deck_id: null as string | null,
        moxfield_url: null as string | null,
        commander_image_url: null as string | null,
        name: data.name,
        avatar_url: null as string | null,
        deck_name: null as string | null,
        deck_moxfield_url: null as string | null,
        deck_commander_image_url: null as string | null,
      }

      if (league && showNewPlayerDeck && newPlayerDeckName.trim()) {
        const deckRes = await fetch(`/api/players/${data.id}/decks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newPlayerDeckName.trim(),
            commander_image_url: newPlayerDeckImage.trim() || null,
            moxfield_url: newPlayerDeckMoxfield.trim() || null,
          }),
        })
        if (deckRes.ok) {
          const deck = await deckRes.json()
          setPlayerDecks((prev) => ({ ...prev, [data.id]: [deck] }))
          await fetch(`/api/leagues/${league.id}/players/${data.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deck_id: deck.id }),
          })
          newLp = { ...newLp, deck_id: deck.id, deck_name: deck.name, deck_moxfield_url: deck.moxfield_url, deck_commander_image_url: deck.commander_image_url }
        }
      }

      if (league) {
        setLeaguePlayers((prev) => [...prev, newLp])
      }
      setNewPlayerName('')
      setNewPlayerDeckName('')
      setNewPlayerDeckImage('')
      setNewPlayerDeckMoxfield('')
      setShowNewPlayerDeck(false)
      showToast(`${data.name} ajouté et inscrit !`)
    } finally {
      setAddPlayerLoading(false)
    }
  }

  async function handleDeletePlayer(id: string, name: string) {
    const res = await fetch('/api/players', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) {
      setPlayers((prev) => prev.filter((p) => p.id !== id))
      showToast(`${name} supprimé`)
    } else {
      const data = await res.json()
      showToast(`Erreur : ${data.error}`)
    }
  }

  async function handleGenerateLeague() {
    setConfirmGenerate(false)
    setGenerateLoading(true)
    setGenerateError('')

    try {
      const res = await fetch('/api/matches/generate', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setGenerateError(data.error)
      } else {
        setMatches(data.matches ?? [])
        showToast(`✓ ${data.count} matchs générés !`)
        router.refresh()
      }
    } finally {
      setGenerateLoading(false)
    }
  }

  async function handleResetLeague() {
    setConfirmResetLeague(false)
    const res = await fetch('/api/matches/generate', { method: 'DELETE' })
    if (res.ok) {
      setMatches([])
      setPlayoffs([])
      showToast('Matchs et playoffs réinitialisés')
      router.refresh()
    } else {
      const data = await res.json()
      showToast(`Erreur : ${data.error}`)
    }
  }

  const handleSaveScore = useCallback(
    async (matchId: string, score_p1: number, score_p2: number) => {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score_p1, score_p2 }),
      })

      if (res.ok) {
        const updated = await res.json()
        setMatches((prev) =>
          prev.map((m) => (m.id === matchId ? { ...m, ...updated } : m))
        )
        showToast('Score enregistré !')
        setSelectedMatch(null)
        router.refresh()
      } else {
        const data = await res.json()
        showToast(`Erreur : ${data.error}`)
      }
    },
    [router]
  )

  async function handleResetScore(matchId: string) {
    const res = await fetch(`/api/matches/${matchId}`, { method: 'DELETE' })
    if (res.ok) {
      const updated = await res.json()
      setMatches((prev) =>
        prev.map((m) => (m.id === matchId ? { ...m, ...updated } : m))
      )
      showToast('Score réinitialisé')
      router.refresh()
    }
  }

  async function handleGeneratePlayoffs() {
    setPlayoffLoading(true)
    setPlayoffError('')
    try {
      const res = await fetch('/api/playoffs', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setPlayoffError(data.error)
      } else {
        setPlayoffs(data)
        showToast('Demi-finales générées !')
        router.refresh()
      }
    } finally {
      setPlayoffLoading(false)
    }
  }

  async function handleResetPlayoffs() {
    setConfirmResetPlayoffs(false)
    const res = await fetch('/api/playoffs', { method: 'DELETE' })
    if (res.ok) {
      setPlayoffs([])
      showToast('Playoffs réinitialisés')
      router.refresh()
    }
  }

  const handleSavePlayoffScore = useCallback(
    async (matchId: string, score_p1: number, score_p2: number) => {
      const res = await fetch(`/api/playoffs/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score_p1, score_p2 }),
      })
      if (res.ok) {
        const { match, generated } = await res.json()
        setPlayoffs((prev) => {
          const updated = prev.map((p) => (p.id === matchId ? match : p))
          // Ajouter les matchs auto-générés (finale + petite finale)
          const newIds = new Set(updated.map((p) => p.id))
          for (const g of generated ?? []) {
            if (!newIds.has(g.id)) updated.push(g)
          }
          return updated
        })
        setSelectedPlayoff(null)
        showToast(generated?.length > 0 ? '✓ Score enregistré · Finale et petite finale générées !' : 'Score enregistré !')
        router.refresh()
      } else {
        const data = await res.json()
        showToast(`Erreur : ${data.error}`)
      }
    },
    [router]
  )

  async function handleResetPlayoffScore(id: string) {
    if (!confirm('Réinitialiser ce score ?')) return
    const res = await fetch(`/api/playoffs/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const updated = await res.json()
      setPlayoffs((prev) => prev.map((p) => (p.id === id ? updated : p)))
      showToast('Score réinitialisé')
    }
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }

  async function handleCreateLeague(e: React.FormEvent) {
    e.preventDefault()
    if (!newLeagueName.trim()) return
    setCreateLeagueLoading(true)
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLeagueName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        showToast(`Erreur : ${data.error}`)
      } else {
        const playersRes = await fetch('/api/players')
        if (playersRes.ok) {
          const playersList = await playersRes.json()
          setPlayers(playersList)
        }
        setLeague(data)
        setLeaguePlayers([])
        setNewLeagueName('')
        showToast(`Saison "${data.name}" créée !`)
        router.refresh()
      }
    } finally {
      setCreateLeagueLoading(false)
    }
  }

  async function handleDeleteLeague() {
    if (!league) return
    setDeleteLoading(true)
    setConfirmDelete(false)
    try {
      const res = await fetch(`/api/leagues/${league.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        showToast(`Erreur : ${data.error}`)
      } else {
        const playersRes = await fetch('/api/players')
        if (playersRes.ok) setPlayers(await playersRes.json())
        setLeague(null)
        setLeaguePlayers([])
        setMatches([])
        setPlayoffs([])
        showToast('Saison supprimée')
        router.refresh()
      }
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleCloseLeague() {
    if (!league) return
    setCloseLoading(true)
    setConfirmClose(false)
    try {
      const res = await fetch(`/api/leagues/${league.id}/close`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(`Erreur : ${data.error}`)
      } else {
        setLeague(null)
        setMatches([])
        setPlayoffs([])
        setPlayers([])
        showToast(`Saison "${data.name}" archivée !`)
        router.refresh()
      }
    } finally {
      setCloseLoading(false)
    }
  }

  // Group matches by round
  const rounds: Record<number, Match[]> = {}
  for (const m of matches) {
    if (!rounds[m.round_number]) rounds[m.round_number] = []
    rounds[m.round_number].push(m)
  }

  const completedCount = matches.filter((m) => m.is_completed).length

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-dc-surface border border-dc-gold/40 text-dc-gold px-5 py-3 rounded-xl shadow-gold text-sm font-semibold animate-pulse">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-dc-gold/10 border border-dc-gold/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-dc-gold" />
          </div>
          <div>
            <h1 className="font-fantasy text-2xl font-bold text-dc-gold">Admin</h1>
            {league && (
              <p className="text-dc-gold/70 text-sm font-semibold">{league.name}</p>
            )}
            <p className="text-dc-muted text-xs">
              {enrolledCount} inscrits · {completedCount}/{matches.length} matchs joués
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {matches.length > 0 && (
            confirmResetLeague ? (
              <div className="flex items-center gap-1.5">
                <span className="text-dc-red-light text-xs hidden sm:block">
                  {matches.filter((m) => m.is_completed).length > 0 ? 'Scores perdus !' : 'Supprimer les matchs ?'}
                </span>
                <button onClick={handleResetLeague} className="text-xs px-3 py-2 bg-dc-red/20 border border-dc-red/40 text-dc-red-light rounded-lg hover:bg-dc-red/30 transition-all">Oui</button>
                <button onClick={() => setConfirmResetLeague(false)} className="text-xs px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all">Non</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmResetLeague(true)}
                className="flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-red-light/30"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Réinitialiser la ligue</span>
              </button>
            )
          )}
          {league && allRRCompleted && (
            (enrolledCount < 4 && playoffs.length === 0) ||
            (playoffs.length > 0 && playoffs.every((p) => p.is_completed))
          ) && (
            confirmClose ? (
              <div className="flex items-center gap-1.5">
                <span className="text-dc-gold text-xs hidden sm:block">Confirmer ?</span>
                <button
                  onClick={handleCloseLeague}
                  disabled={closeLoading}
                  className="text-xs px-3 py-2 bg-dc-gold/20 border border-dc-gold/40 text-dc-gold rounded-lg hover:bg-dc-gold/30 transition-all disabled:opacity-40"
                >
                  {closeLoading ? 'Clôture…' : 'Oui'}
                </button>
                <button
                  onClick={() => setConfirmClose(false)}
                  className="text-xs px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all"
                >
                  Non
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClose(true)}
                className="flex items-center gap-1.5 text-dc-muted hover:text-dc-gold text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-gold/30"
              >
                <Archive className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Clôturer la saison</span>
              </button>
            )
          )}
          {league && (
            confirmDelete ? (
              <div className="flex items-center gap-1.5">
                <span className="text-dc-red-light text-xs hidden sm:block">Supprimer la saison ?</span>
                <button onClick={handleDeleteLeague} disabled={deleteLoading} className="text-xs px-3 py-2 bg-dc-red/20 border border-dc-red/40 text-dc-red-light rounded-lg hover:bg-dc-red/30 transition-all disabled:opacity-40">
                  {deleteLoading ? '…' : 'Oui'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all">
                  Non
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-red-light/30">
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:block">Supprimer la saison</span>
              </button>
            )
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-dc-muted hover:text-dc-text text-sm px-3 py-2 rounded-lg hover:bg-dc-border/30 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:block">Déconnexion</span>
          </button>
        </div>
      </div>

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

      {/* Section: Participants */}
      {league && !leagueStarted && (
        <div className="bg-dc-surface border border-dc-border rounded-2xl p-5 space-y-5">
          <h2 className="font-fantasy font-bold text-dc-text flex items-center gap-2">
            <Users className="w-5 h-5 text-dc-gold" />
            Participants ({enrolledCount})
          </h2>

          {/* Zone A: existing players */}
          {players.length > 0 && (
            <div className="space-y-2">
              <p className="text-dc-muted text-xs uppercase tracking-wide">Joueurs existants</p>
              {players.map((player) => {
                const isEnrolled = enrolledIds.has(player.id)
                const decksForPlayer = playerDecks[player.id] ?? []
                const enrollment = leaguePlayers.find((lp) => lp.player_id === player.id)
                const assignedDeckId = enrollment?.deck_id ?? ''
                const isCreatingDeck = creatingDeckForPlayerId === player.id

                return (
                  <div key={player.id} className="space-y-2">
                    <div className="flex items-center gap-3 bg-dc-bg/50 border border-dc-border/40 rounded-xl px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={isEnrolled}
                        onChange={() => handleToggleEnroll(player, isEnrolled)}
                        className="w-4 h-4 accent-dc-gold cursor-pointer"
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-dc-border/60 flex items-center justify-center shrink-0">
                          <span className="text-dc-gold font-bold text-xs">
                            {player.name.slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-dc-text text-sm font-semibold truncate">{player.name}</span>
                      </div>
                      {isEnrolled && (
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            value={assignedDeckId}
                            onChange={(e) => {
                              if (e.target.value === '__new__') {
                                setCreatingDeckForPlayerId(player.id)
                                setNewDeckName('')
                                setNewDeckImage('')
                                setNewDeckMoxfield('')
                              } else {
                                handleAssignDeck(player.id, e.target.value)
                              }
                            }}
                            className="bg-dc-bg border border-dc-border rounded-lg px-2 py-1.5 text-dc-text text-xs focus:outline-none focus:border-dc-gold/50 transition-colors max-w-[160px]"
                          >
                            <option value="">Sans deck</option>
                            {decksForPlayer.map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                            <option value="__new__">+ Nouveau deck</option>
                          </select>
                        </div>
                      )}
                      <button
                        onClick={() => handleDeletePlayer(player.id, player.name)}
                        disabled={historySet.has(player.id)}
                        title={
                          isEnrolled
                            ? 'Désinscris le joueur avant de le supprimer'
                            : historySet.has(player.id)
                              ? 'Ce joueur a participé à une league et ne peut pas être supprimé'
                              : 'Supprimer'
                        }
                        className="text-dc-muted hover:text-dc-red-light transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {isCreatingDeck && (
                      <form
                        onSubmit={(e) => handleCreateDeck(e, player.id)}
                        className="ml-8 bg-dc-bg/70 border border-dc-gold/20 rounded-xl px-4 py-3 space-y-2"
                      >
                        <p className="text-dc-gold text-xs font-semibold">Nouveau deck pour {player.name}</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div>
                            <label className="block text-dc-muted text-xs mb-1">Nom du deck *</label>
                            <input
                              type="text"
                              value={newDeckName}
                              onChange={(e) => setNewDeckName(e.target.value)}
                              placeholder="ex: Ur-Dragon"
                              autoFocus
                              className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-dc-muted text-xs mb-1">Image commandant</label>
                            <input
                              type="url"
                              value={newDeckImage}
                              onChange={(e) => setNewDeckImage(e.target.value)}
                              placeholder="https://assets.moxfield.net/..."
                              className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-dc-muted text-xs mb-1">Lien Moxfield</label>
                            <input
                              type="url"
                              value={newDeckMoxfield}
                              onChange={(e) => setNewDeckMoxfield(e.target.value)}
                              placeholder="https://moxfield.com/decks/..."
                              className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={!newDeckName.trim() || deckLoading}
                            className="flex items-center gap-1.5 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {deckLoading ? 'Création…' : 'Créer et assigner'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCreatingDeckForPlayerId(null)}
                            className="flex items-center gap-1.5 text-dc-muted hover:text-dc-text px-3 py-1.5 rounded-lg text-xs transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Annuler
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <div className="border-t border-dc-border/50" />

          <div className="space-y-3">
            <p className="text-dc-muted text-xs uppercase tracking-wide">Nouveau joueur</p>
            <form onSubmit={handleAddNewPlayer} className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="ex: Alexandre"
                  className="flex-1 bg-dc-bg border border-dc-border rounded-xl px-4 py-2.5 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 transition-colors text-sm"
                />
                <button
                  type="submit"
                  disabled={!newPlayerName.trim() || addPlayerLoading}
                  className="flex items-center gap-2 bg-dc-gold/15 hover:bg-dc-gold/25 border border-dc-gold/30 text-dc-gold px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-4 h-4" />
                  {addPlayerLoading ? 'Ajout…' : 'Ajouter'}
                </button>
              </div>

              {!showNewPlayerDeck && (
                <button
                  type="button"
                  onClick={() => setShowNewPlayerDeck(true)}
                  className="flex items-center gap-1.5 text-dc-muted hover:text-dc-gold text-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter un deck (optionnel)
                </button>
              )}

              {showNewPlayerDeck && (
                <div className="bg-dc-bg/70 border border-dc-gold/20 rounded-xl px-4 py-3 space-y-2">
                  <p className="text-dc-gold text-xs font-semibold">Deck du nouveau joueur (optionnel)</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div>
                      <label className="block text-dc-muted text-xs mb-1">Nom du deck</label>
                      <input
                        type="text"
                        value={newPlayerDeckName}
                        onChange={(e) => setNewPlayerDeckName(e.target.value)}
                        placeholder="ex: Ur-Dragon"
                        className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-dc-muted text-xs mb-1">Image commandant</label>
                      <input
                        type="url"
                        value={newPlayerDeckImage}
                        onChange={(e) => setNewPlayerDeckImage(e.target.value)}
                        placeholder="https://assets.moxfield.net/..."
                        className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-dc-muted text-xs mb-1">Lien Moxfield</label>
                      <input
                        type="url"
                        value={newPlayerDeckMoxfield}
                        onChange={(e) => setNewPlayerDeckMoxfield(e.target.value)}
                        placeholder="https://moxfield.com/decks/..."
                        className="w-full bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setShowNewPlayerDeck(false); setNewPlayerDeckName(''); setNewPlayerDeckImage(''); setNewPlayerDeckMoxfield('') }}
                    className="flex items-center gap-1.5 text-dc-muted hover:text-dc-text text-xs transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Annuler le deck
                  </button>
                </div>
              )}
            </form>
            {addPlayerError && (
              <p className="text-dc-red-light text-sm bg-dc-red/20 border border-dc-red/30 rounded-lg px-3 py-2">
                {addPlayerError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Section 2: Generate league */}
      {league && !leagueStarted && enrolledCount >= 2 && (
        <div className="bg-dc-surface border border-dc-gold/20 rounded-2xl p-5 space-y-3">
          <h2 className="font-fantasy font-bold text-dc-gold flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Générer la ligue
          </h2>
          <p className="text-dc-muted text-sm">
            {enrolledCount} joueurs → {(enrolledCount * (enrolledCount - 1)) / 2} matchs Round Robin.
            {enrolledCount % 2 !== 0 && ' (Nombre impair : 1 bye par round, ignoré au classement)'}
          </p>

          {generateError && (
            <div className="flex items-start gap-2 text-dc-red-light text-sm bg-dc-red/20 border border-dc-red/30 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {generateError}
            </div>
          )}

          {confirmGenerate ? (
            <div className="flex gap-2">
              <button
                onClick={handleGenerateLeague}
                disabled={generateLoading}
                className="flex-1 flex items-center justify-center gap-2 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold font-fantasy font-bold px-5 py-3 rounded-xl transition-all disabled:opacity-40"
              >
                <Zap className="w-5 h-5" />
                {generateLoading ? 'Génération…' : 'Confirmer la génération'}
              </button>
              <button
                onClick={() => setConfirmGenerate(false)}
                className="px-4 py-3 border border-dc-border/50 text-dc-muted rounded-xl hover:text-dc-text transition-all text-sm"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmGenerate(true)}
              className="flex items-center gap-2 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold font-fantasy font-bold px-5 py-3 rounded-xl transition-all w-full justify-center"
            >
              <Zap className="w-5 h-5" />
              {`Générer la ligue (${enrolledCount} joueurs)`}
            </button>
          )}
        </div>
      )}

      {/* Section 3: Match management */}
      {leagueStarted && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-fantasy font-bold text-dc-text text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-dc-gold" />
              Matchs — {completedCount}/{matches.length} joués
            </h2>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-dc-red-light text-xs">Supprimer la saison ?</span>
                <button onClick={handleDeleteLeague} disabled={deleteLoading} className="text-xs px-3 py-1.5 bg-dc-red/20 border border-dc-red/40 text-dc-red-light rounded-lg hover:bg-dc-red/30 transition-all disabled:opacity-40">
                  {deleteLoading ? '…' : 'Oui'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs px-3 py-1.5 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all">
                  Non
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-1.5 border border-dc-border/50 rounded-lg transition-all hover:border-dc-red-light/30">
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer la saison
              </button>
            )}
          </div>

          {Object.entries(rounds)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([round, roundMatches]) => {
              const allDone = roundMatches.every((m) => m.is_completed)
              return (
                <div key={round}>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        allDone
                          ? 'bg-dc-green/40 border-dc-green-light/30 text-dc-green-light'
                          : 'bg-dc-surface border-dc-border text-dc-muted'
                      }`}
                    >
                      Round {round}
                    </div>
                    <div className="flex-1 h-px bg-dc-border/50" />
                  </div>

                  <div className="space-y-2">
                    {roundMatches.map((match) => {
                      const p1 = playerMap[match.player1_id]
                      const p2 = playerMap[match.player2_id]
                      if (!p1 || !p2) return null

                      const enriched = { ...match, player1: p1, player2: p2 }

                      return (
                        <div key={match.id} className="relative group">
                          <MatchCard
                            match={enriched}
                            isAdmin={true}
                            onEdit={() => setSelectedMatch(match)}
                          />
                          {match.is_completed && (
                            <button
                              onClick={() => handleResetScore(match.id)}
                              className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity text-dc-muted hover:text-dc-red-light p-1"
                              title="Réinitialiser le score"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Section 4: Playoffs */}
      {leagueStarted && (allRRCompleted || playoffs.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-fantasy font-bold text-dc-gold text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Playoffs — Top 4
            </h2>
            {playoffs.length > 0 && (
              confirmResetPlayoffs ? (
                <div className="flex items-center gap-1.5">
                  <button onClick={handleResetPlayoffs} className="text-xs px-3 py-1.5 bg-dc-red/20 border border-dc-red/40 text-dc-red-light rounded-lg hover:bg-dc-red/30 transition-all">Oui</button>
                  <button onClick={() => setConfirmResetPlayoffs(false)} className="text-xs px-3 py-1.5 border border-dc-border/50 text-dc-muted rounded-lg hover:text-dc-text transition-all">Non</button>
                </div>
              ) : (
              <button
                onClick={() => setConfirmResetPlayoffs(true)}
                className="flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-1.5 border border-dc-border/50 rounded-lg transition-all hover:border-dc-red-light/30"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Reset playoffs
              </button>
              )
            )}
          </div>

          {/* Bouton génération */}
          {playoffs.length === 0 && allRRCompleted && (
            <div className="bg-dc-surface border border-dc-gold/20 rounded-2xl p-5 space-y-3">
              {enrolledCount < 4 ? (
                <p className="text-dc-muted text-sm">
                  Il faut au moins 4 joueurs inscrits pour générer le Top 4 ({enrolledCount} inscrits). La saison peut être clôturée directement.
                </p>
              ) : (
                <>
                  <p className="text-dc-muted text-sm">
                    Tous les matchs de ligue sont joués. Génère les demi-finales pour commencer le Top 4.
                  </p>
                  {playoffError && (
                    <div className="flex items-start gap-2 text-dc-red-light text-sm bg-dc-red/20 border border-dc-red/30 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      {playoffError}
                    </div>
                  )}
                  <button
                    onClick={handleGeneratePlayoffs}
                    disabled={playoffLoading}
                    className="flex items-center gap-2 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold font-fantasy font-bold px-5 py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed w-full justify-center"
                  >
                    <Trophy className="w-5 h-5" />
                    {playoffLoading ? 'Génération…' : 'Générer le Top 4'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Matchs playoffs */}
          {playoffs.length > 0 && (() => {
            const stageLabels: Record<string, { label: string; icon: React.ElementType }> = {
              semi1:       { label: 'Demi-finale 1 · 1er vs 4ème', icon: Trophy },
              semi2:       { label: 'Demi-finale 2 · 2ème vs 3ème', icon: Trophy },
              final:       { label: 'Grande Finale', icon: Trophy },
              third_place: { label: 'Petite Finale · 3ème place', icon: Award },
            }

            const grouped: Record<string, DbPlayoff[]> = {
              semis: playoffs.filter((p) => p.stage === 'semi1' || p.stage === 'semi2'),
              finals: playoffs.filter((p) => p.stage === 'final' || p.stage === 'third_place'),
            }

            return (
              <div className="space-y-6">
                {grouped.semis.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-dc-muted text-xs uppercase tracking-widest font-bold">Demi-finales</p>
                    {grouped.semis.map((playoff) => {
                      const p1 = playoff.player1_id ? playerMap[playoff.player1_id] as unknown as Player : null
                      const p2 = playoff.player2_id ? playerMap[playoff.player2_id] as unknown as Player : null
                      if (!p1 || !p2) return null
                      const info = stageLabels[playoff.stage]
                      return (
                        <div key={playoff.id} className="relative group">
                          <MatchCard
                            match={{
                              id: playoff.id,
                              player1_id: playoff.player1_id!,
                              player2_id: playoff.player2_id!,
                              score_p1: playoff.score_p1,
                              score_p2: playoff.score_p2,
                              is_completed: playoff.is_completed,
                              round_number: 0,
                              player1: p1,
                              player2: p2,
                            }}
                            isAdmin={true}
                            onEdit={() => !playoff.is_completed && setSelectedPlayoff(playoff)}
                          />
                          {playoff.is_completed && (
                            <button
                              onClick={() => handleResetPlayoffScore(playoff.id)}
                              className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity text-dc-muted hover:text-dc-red-light p-1"
                              title="Réinitialiser"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <p className="text-dc-muted text-xs mt-1 ml-1">{info.label}</p>
                        </div>
                      )
                    })}
                  </div>
                )}

                {grouped.finals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-dc-muted text-xs uppercase tracking-widest font-bold">Finales</p>
                    {grouped.finals.map((playoff) => {
                      const p1 = playoff.player1_id ? playerMap[playoff.player1_id] as unknown as Player : null
                      const p2 = playoff.player2_id ? playerMap[playoff.player2_id] as unknown as Player : null
                      if (!p1 || !p2) return null
                      const info = stageLabels[playoff.stage]
                      return (
                        <div key={playoff.id} className="relative group">
                          <MatchCard
                            match={{
                              id: playoff.id,
                              player1_id: playoff.player1_id!,
                              player2_id: playoff.player2_id!,
                              score_p1: playoff.score_p1,
                              score_p2: playoff.score_p2,
                              is_completed: playoff.is_completed,
                              round_number: 0,
                              player1: p1,
                              player2: p2,
                            }}
                            isAdmin={true}
                            onEdit={() => !playoff.is_completed && setSelectedPlayoff(playoff)}
                          />
                          {playoff.is_completed && (
                            <button
                              onClick={() => handleResetPlayoffScore(playoff.id)}
                              className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity text-dc-muted hover:text-dc-red-light p-1"
                              title="Réinitialiser"
                            >
                              <RefreshCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <p className={`text-xs mt-1 ml-1 ${playoff.stage === 'final' ? 'text-dc-gold/70' : 'text-dc-muted'}`}>
                            {info.label}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Score modal RR */}
      {selectedMatch && playerMap[selectedMatch.player1_id] && playerMap[selectedMatch.player2_id] && (
        <ScoreModal
          match={{
            ...selectedMatch,
            player1: playerMap[selectedMatch.player1_id],
            player2: playerMap[selectedMatch.player2_id],
          }}
          onClose={() => setSelectedMatch(null)}
          onSave={handleSaveScore}
        />
      )}

      {/* Score modal Playoffs */}
      {selectedPlayoff && selectedPlayoff.player1_id && selectedPlayoff.player2_id &&
       playerMap[selectedPlayoff.player1_id] && playerMap[selectedPlayoff.player2_id] && (
        <ScoreModal
          allowDraw={false}
          match={{
            id: selectedPlayoff.id,
            player1_id: selectedPlayoff.player1_id,
            player2_id: selectedPlayoff.player2_id,
            score_p1: selectedPlayoff.score_p1,
            score_p2: selectedPlayoff.score_p2,
            is_completed: selectedPlayoff.is_completed,
            round_number: 0,
            player1: playerMap[selectedPlayoff.player1_id] as unknown as Player,
            player2: playerMap[selectedPlayoff.player2_id] as unknown as Player,
          }}
          onClose={() => setSelectedPlayoff(null)}
          onSave={handleSavePlayoffScore}
        />
      )}
    </div>
  )
}
