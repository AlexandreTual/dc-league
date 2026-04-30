'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Match, Player } from '@/lib/leaderboard'
import { DbPlayoff, DbPlayer } from '@/lib/db'
import MatchCard from '@/components/MatchCard'
import ScoreModal from '@/components/ScoreModal'
import {
  Shield,
  UserPlus,
  Zap,
  LogOut,
  Trash2,
  ExternalLink,
  AlertTriangle,
  RefreshCcw,
  Trophy,
  Award,
} from 'lucide-react'

interface Props {
  initialPlayers: Player[]
  initialMatches: Match[]
  initialPlayoffs: DbPlayoff[]
  allRRCompleted: boolean
}

export default function AdminDashboard({ initialPlayers, initialMatches, initialPlayoffs, allRRCompleted }: Props) {
  const router = useRouter()

  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [matches, setMatches] = useState<Match[]>(initialMatches)
  const [playoffs, setPlayoffs] = useState<DbPlayoff[]>(initialPlayoffs)

  const [newName, setNewName] = useState('')
  const [newMoxfield, setNewMoxfield] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [playoffLoading, setPlayoffLoading] = useState(false)

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [selectedPlayoff, setSelectedPlayoff] = useState<DbPlayoff | null>(null)
  const [toast, setToast] = useState('')

  const leagueStarted = matches.length > 0

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Build player map
  const playerMap: Record<string, Player> = {}
  for (const p of players) playerMap[p.id] = p

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return

    setAddLoading(true)
    setAddError('')

    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), moxfield_url: newMoxfield.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setAddError(data.error)
      } else {
        setPlayers((prev) => [...prev, data])
        setNewName('')
        setNewMoxfield('')
        showToast(`${data.name} ajouté !`)
      }
    } finally {
      setAddLoading(false)
    }
  }

  async function handleDeletePlayer(id: string, name: string) {
    if (!confirm(`Supprimer ${name} ?`)) return

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
    if (!confirm(`Générer la ligue pour ${players.length} joueurs ? Cette action est irréversible (sauf si aucun match n'a été joué).`)) return

    setGenerateLoading(true)
    setGenerateError('')

    try {
      const res = await fetch('/api/matches/generate', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setGenerateError(data.error)
      } else {
        showToast(`✓ ${data.count} matchs générés !`)
        router.refresh()
        // Reload matches from API
        const matchRes = await fetch('/api/players') // trigger refresh via router
        router.refresh()
      }
    } finally {
      setGenerateLoading(false)
    }
  }

  async function handleResetLeague() {
    const completed = matches.filter((m) => m.is_completed).length
    const msg = completed > 0
      ? `⚠️ ${completed} match(s) ont déjà été joués. Supprimer quand même TOUS les matchs ? Les scores seront perdus.`
      : 'Supprimer tous les matchs générés ?'
    if (!confirm(msg)) return

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
    if (!confirm('Réinitialiser ce score ?')) return
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
    if (!confirm('Générer les demi-finales du Top 4 ?')) return
    setPlayoffLoading(true)
    try {
      const res = await fetch('/api/playoffs', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        showToast(`Erreur : ${data.error}`)
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
    if (!confirm('Supprimer tous les matchs de playoffs ?')) return
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
            <p className="text-dc-muted text-xs">{players.length} joueurs · {completedCount}/{matches.length} matchs joués</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {matches.length > 0 && (
            <button
              onClick={handleResetLeague}
              className="flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-2 border border-dc-border/50 rounded-lg transition-all hover:border-dc-red-light/30"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:block">Réinitialiser la ligue</span>
            </button>
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

      {/* Section 1: Add player */}
      {!leagueStarted && (
        <div className="bg-dc-surface border border-dc-border rounded-2xl p-5 space-y-4">
          <h2 className="font-fantasy font-bold text-dc-text flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-dc-gold" />
            Ajouter un joueur
          </h2>

          <form onSubmit={handleAddPlayer} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-dc-muted text-xs mb-1">Nom du joueur *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ex: Alexandre"
                  className="w-full bg-dc-bg border border-dc-border rounded-xl px-4 py-2.5 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="block text-dc-muted text-xs mb-1">Lien Moxfield</label>
                <input
                  type="url"
                  value={newMoxfield}
                  onChange={(e) => setNewMoxfield(e.target.value)}
                  placeholder="https://moxfield.com/decks/..."
                  className="w-full bg-dc-bg border border-dc-border rounded-xl px-4 py-2.5 text-dc-text placeholder-dc-muted/50 focus:outline-none focus:border-dc-gold/50 transition-colors text-sm"
                />
              </div>
            </div>

            {addError && (
              <p className="text-dc-red-light text-sm bg-dc-red/20 border border-dc-red/30 rounded-lg px-3 py-2">
                {addError}
              </p>
            )}

            <button
              type="submit"
              disabled={!newName.trim() || addLoading}
              className="flex items-center gap-2 bg-dc-gold/15 hover:bg-dc-gold/25 border border-dc-gold/30 text-dc-gold px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              {addLoading ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>

          {/* Players list */}
          {players.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-dc-border/50">
              <p className="text-dc-muted text-xs">
                {players.length} joueur{players.length > 1 ? 's' : ''} inscrit{players.length > 1 ? 's' : ''} — il en faut entre 4 et 8 pour une bonne ligue.
              </p>
              {players.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between bg-dc-bg/50 border border-dc-border/40 rounded-xl px-4 py-2.5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-dc-border/60 flex items-center justify-center shrink-0">
                      <span className="text-dc-gold font-bold text-xs">
                        {player.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-dc-text text-sm font-semibold truncate">{player.name}</span>
                    {player.moxfield_url && (
                      <a
                        href={player.moxfield_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-dc-muted hover:text-dc-gold transition-colors shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePlayer(player.id, player.name)}
                    className="text-dc-muted hover:text-dc-red-light transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 2: Generate league */}
      {!leagueStarted && players.length >= 2 && (
        <div className="bg-dc-surface border border-dc-gold/20 rounded-2xl p-5 space-y-3">
          <h2 className="font-fantasy font-bold text-dc-gold flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Générer la ligue
          </h2>
          <p className="text-dc-muted text-sm">
            {players.length} joueurs → {(players.length * (players.length - 1)) / 2} matchs Round Robin.
            {players.length % 2 !== 0 && ' (Nombre impair : 1 bye par round, ignoré au classement)'}
          </p>

          {generateError && (
            <div className="flex items-start gap-2 text-dc-red-light text-sm bg-dc-red/20 border border-dc-red/30 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {generateError}
            </div>
          )}

          <button
            onClick={handleGenerateLeague}
            disabled={generateLoading}
            className="flex items-center gap-2 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold font-fantasy font-bold px-5 py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed w-full justify-center"
          >
            <Zap className="w-5 h-5" />
            {generateLoading ? 'Génération…' : `Générer la ligue (${players.length} joueurs)`}
          </button>
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
              <button
                onClick={handleResetPlayoffs}
                className="flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-1.5 border border-dc-border/50 rounded-lg transition-all hover:border-dc-red-light/30"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Reset playoffs
              </button>
            )}
          </div>

          {/* Bouton génération */}
          {playoffs.length === 0 && allRRCompleted && (
            <div className="bg-dc-surface border border-dc-gold/20 rounded-2xl p-5 space-y-3">
              <p className="text-dc-muted text-sm">
                Tous les matchs de ligue sont joués. Génère les demi-finales pour commencer le Top 4.
              </p>
              <button
                onClick={handleGeneratePlayoffs}
                disabled={playoffLoading}
                className="flex items-center gap-2 bg-dc-gold/20 hover:bg-dc-gold/30 border border-dc-gold/40 text-dc-gold font-fantasy font-bold px-5 py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed w-full justify-center"
              >
                <Trophy className="w-5 h-5" />
                {playoffLoading ? 'Génération…' : 'Générer le Top 4'}
              </button>
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
