'use client'

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, RefreshCcw, Trophy } from 'lucide-react'
import type { Player } from '@/lib/leaderboard'
import type { DbPlayoff } from '@/lib/db'
import ScoreModal from '@/components/ScoreModal'
import { sendJson } from '@/components/formStyles'
import PlayoffMatch from './PlayoffMatch'
import type { AdminApi } from './useAdminApi'

const STAGE_LABELS: Record<string, string> = {
  semi1: 'Demi-finale 1 · 1er vs 4ème',
  semi2: 'Demi-finale 2 · 2ème vs 3ème',
  final: 'Grande Finale',
  third_place: 'Petite Finale · 3ème place',
}

/** Top 4 : génération des demi-finales, puis matchs de playoffs et leurs scores. */
export default function PlayoffsPanel({
  api, playoffs, setPlayoffs, playerMap, allRRCompleted, enrolledCount,
}: {
  api: AdminApi
  playoffs: DbPlayoff[]
  setPlayoffs: Dispatch<SetStateAction<DbPlayoff[]>>
  playerMap: Record<string, Player>
  allRRCompleted: boolean
  enrolledCount: number
}) {
  const router = useRouter()
  const { showToast, call } = api

  const [playoffLoading, setPlayoffLoading] = useState(false)
  const [playoffError, setPlayoffError] = useState('')
  const [confirmResetPlayoffs, setConfirmResetPlayoffs] = useState(false)
  const [selectedPlayoff, setSelectedPlayoff] = useState<DbPlayoff | null>(null)

  async function handleGeneratePlayoffs() {
    setPlayoffLoading(true)
    setPlayoffError('')
    try {
      const { error, data } = await sendJson('/api/playoffs', 'POST')
      if (error) {
        setPlayoffError(error)
      } else {
        setPlayoffs(data as DbPlayoff[])
        showToast('Demi-finales générées !')
        router.refresh()
      }
    } finally {
      setPlayoffLoading(false)
    }
  }

  async function handleResetPlayoffs() {
    setConfirmResetPlayoffs(false)
    const { ok } = await call('/api/playoffs', 'DELETE')
    if (!ok) return
    setPlayoffs([])
    showToast('Playoffs réinitialisés')
    router.refresh()
  }

  const handleSavePlayoffScore = useCallback(
    async (matchId: string, score_p1: number, score_p2: number) => {
      const { ok, data } = await call<{ match: DbPlayoff; generated?: DbPlayoff[] }>(`/api/playoffs/${matchId}`, 'PATCH', { score_p1, score_p2 })
      if (!ok || !data) return
      const { match, generated } = data
      setPlayoffs((prev) => {
        // Finale et petite finale créées ou corrigées : remplacer celles déjà affichées, ajouter les autres.
        const changed = [match, ...(generated ?? [])]
        const byId = new Map(changed.map((p) => [p.id, p]))
        const updated = prev.map((p) => byId.get(p.id) ?? p)
        for (const g of changed) {
          if (!prev.some((p) => p.id === g.id)) updated.push(g)
        }
        return updated
      })
      setSelectedPlayoff(null)
      showToast(generated && generated.length > 0 ? '✓ Score enregistré · Finale et petite finale à jour !' : 'Score enregistré !')
      router.refresh()
    },
    [call, router, setPlayoffs, showToast]
  )

  async function handleResetPlayoffScore(id: string) {
    if (!confirm('Réinitialiser ce score ?')) return
    const { ok, data } = await call<DbPlayoff>(`/api/playoffs/${id}`, 'DELETE')
    if (!ok) return
    const updated = data as DbPlayoff
    setPlayoffs((prev) => prev.map((p) => (p.id === id ? updated : p)))
    showToast('Score réinitialisé')
  }

  /** Matchs jouables : les deux joueurs sont connus et présents au classement. */
  const withPlayers = (stages: string[]) =>
    playoffs
      .filter((p) => stages.includes(p.stage))
      .map((playoff) => ({
        playoff,
        p1: playoff.player1_id ? playerMap[playoff.player1_id] : null,
        p2: playoff.player2_id ? playerMap[playoff.player2_id] : null,
      }))

  const semis = withPlayers(['semi1', 'semi2'])
  const finals = withPlayers(['final', 'third_place'])

  const groups: { key: string; title: string; matches: typeof semis }[] = [
    { key: 'semis', title: 'Demi-finales', matches: semis },
    { key: 'finals', title: 'Finales', matches: finals },
  ]

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-fantasy font-bold text-dc-gold text-lg flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Playoffs — Top 4
          </h2>
          {playoffs.length > 0 && (
            confirmResetPlayoffs ? (
              <div className="flex items-center gap-1.5">
                <span className="text-dc-red-light text-xs">Effacer les playoffs ?</span>
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
        {playoffs.length > 0 && (
          <div className="space-y-6">
            {groups.map(({ key, title, matches }) => matches.length > 0 && (
              <div key={key} className="space-y-2">
                <p className="text-dc-muted text-xs uppercase tracking-widest font-bold">{title}</p>
                {matches.map(({ playoff, p1, p2 }) =>
                  p1 && p2 ? (
                    <PlayoffMatch
                      key={playoff.id}
                      playoff={playoff}
                      player1={p1}
                      player2={p2}
                      label={STAGE_LABELS[playoff.stage]}
                      onEdit={() => setSelectedPlayoff(playoff)}
                      onReset={() => handleResetPlayoffScore(playoff.id)}
                    />
                  ) : null
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
            player1: playerMap[selectedPlayoff.player1_id],
            player2: playerMap[selectedPlayoff.player2_id],
          }}
          onClose={() => setSelectedPlayoff(null)}
          onSave={handleSavePlayoffScore}
        />
      )}
    </>
  )
}
