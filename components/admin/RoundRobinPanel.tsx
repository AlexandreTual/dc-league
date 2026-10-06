'use client'

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCcw, Zap } from 'lucide-react'
import type { Match, Player } from '@/lib/leaderboard'
import MatchCard from '@/components/MatchCard'
import ScoreModal from '@/components/ScoreModal'
import { sendJson } from '@/components/formStyles'
import type { AdminApi } from './useAdminApi'

/** Génération de la ligue (avant le premier match) puis matchs Round Robin par round. */
export default function RoundRobinPanel({
  api, matches, setMatches, playerMap, enrolledCount, leagueStarted, canGenerate,
}: {
  api: AdminApi
  matches: Match[]
  setMatches: Dispatch<SetStateAction<Match[]>>
  playerMap: Record<string, Player>
  enrolledCount: number
  leagueStarted: boolean
  /** Une saison est active, sans match généré, avec au moins deux inscrits. */
  canGenerate: boolean
}) {
  const router = useRouter()
  const { showToast, call } = api

  const [generateLoading, setGenerateLoading] = useState(false)
  const [generateError, setGenerateError] = useState('')
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)

  async function handleGenerateLeague() {
    setConfirmGenerate(false)
    setGenerateLoading(true)
    setGenerateError('')

    try {
      const { error, data } = await sendJson('/api/matches/generate', 'POST')
      if (error) {
        setGenerateError(error)
      } else {
        const result = data as { matches?: Match[]; count: number }
        setMatches(result.matches ?? [])
        showToast(`✓ ${result.count} matchs générés !`)
        router.refresh()
      }
    } finally {
      setGenerateLoading(false)
    }
  }

  const handleSaveScore = useCallback(
    async (matchId: string, score_p1: number, score_p2: number) => {
      const { ok, data } = await call<Partial<Match>>(`/api/matches/${matchId}`, 'PATCH', { score_p1, score_p2 })
      if (!ok) return
      setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...data } : m)))
      showToast('Score enregistré !')
      setSelectedMatch(null)
      router.refresh()
    },
    [call, router, setMatches, showToast]
  )

  async function handleResetScore(matchId: string) {
    if (!confirm('Réinitialiser ce score ?')) return
    const { ok, data } = await call<Partial<Match>>(`/api/matches/${matchId}`, 'DELETE')
    if (!ok) return
    setMatches((prev) => prev.map((m) => (m.id === matchId ? { ...m, ...data } : m)))
    showToast('Score réinitialisé')
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
    <>
      {/* Section 2: Generate league */}
      {canGenerate && (
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
          <h2 className="font-fantasy font-bold text-dc-text text-lg flex items-center gap-2">
            <Zap className="w-5 h-5 text-dc-gold" />
            Matchs — {completedCount}/{matches.length} joués
          </h2>

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
                              className="absolute top-3 left-3 transition-opacity text-dc-muted hover:text-dc-red-light p-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
                              title="Réinitialiser le score"
                              aria-label="Réinitialiser le score"
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
    </>
  )
}
