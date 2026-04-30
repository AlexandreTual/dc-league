'use client'

import { useState } from 'react'
import { X, Check } from 'lucide-react'
import { Match, Player } from '@/lib/leaderboard'

interface Props {
  match: Match & { player1: Player; player2: Player }
  onClose: () => void
  onSave: (matchId: string, score_p1: number, score_p2: number) => Promise<void>
  allowDraw?: boolean
}

const ALL_SCORES = [
  { label: '2 – 0', s1: 2, s2: 0 },
  { label: '2 – 1', s1: 2, s2: 1 },
  { label: '1 – 1', s1: 1, s2: 1 },
  { label: '1 – 2', s1: 1, s2: 2 },
  { label: '0 – 2', s1: 0, s2: 2 },
]

export default function ScoreModal({ match, onClose, onSave, allowDraw = true }: Props) {
  const VALID_SCORES = allowDraw ? ALL_SCORES : ALL_SCORES.filter((s) => s.s1 !== s.s2)
  const [selected, setSelected] = useState<{ s1: number; s2: number } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!selected) return
    setLoading(true)
    try {
      await onSave(match.id, selected.s1, selected.s2)
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-dc-border">
          <h2 className="font-fantasy font-bold text-dc-gold">Résultat du match</h2>
          <button
            onClick={onClose}
            className="text-dc-muted hover:text-dc-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Players */}
        <div className="p-5">
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="font-fantasy font-semibold text-dc-text">{match.player1.name}</span>
            <span className="text-dc-muted text-sm">vs</span>
            <span className="font-fantasy font-semibold text-dc-text">{match.player2.name}</span>
          </div>

          <p className="text-dc-muted text-xs text-center mb-4">
            Sélectionne le score ({match.player1.name} – {match.player2.name})
          </p>

          {/* Score buttons */}
          <div className="space-y-2">
            {VALID_SCORES.map(({ label, s1, s2 }) => {
              const isSelected = selected?.s1 === s1 && selected?.s2 === s2
              let resultLabel = ''
              if (s1 > s2) resultLabel = `${match.player1.name} gagne`
              else if (s2 > s1) resultLabel = `${match.player2.name} gagne`
              else resultLabel = 'Match nul'

              return (
                <button
                  key={label}
                  onClick={() => setSelected({ s1, s2 })}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-dc-gold/15 border-dc-gold/50 text-dc-gold'
                      : 'bg-dc-bg/50 border-dc-border hover:border-dc-gold/30 text-dc-text'
                  }`}
                >
                  <span className="font-fantasy font-bold text-lg">{label}</span>
                  <span className={`text-xs ${isSelected ? 'text-dc-gold/80' : 'text-dc-muted'}`}>
                    {resultLabel}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-dc-gold" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-dc-border text-dc-muted hover:text-dc-text hover:border-dc-text/30 transition-all text-sm"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!selected || loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-dc-gold/20 border border-dc-gold/40 text-dc-gold font-semibold hover:bg-dc-gold/30 transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Enregistrement…' : 'Valider'}
          </button>
        </div>
      </div>
    </div>
  )
}
