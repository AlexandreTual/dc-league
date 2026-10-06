'use client'

import { RefreshCcw } from 'lucide-react'
import type { Player } from '@/lib/leaderboard'
import type { DbPlayoff } from '@/lib/db'
import MatchCard from '@/components/MatchCard'

/** Un match de playoffs (demi-finale, finale ou petite finale) avec son libellé sous la carte. */
export default function PlayoffMatch({ playoff, player1, player2, label, onEdit, onReset }: {
  playoff: DbPlayoff
  player1: Player
  player2: Player
  label: string
  onEdit: () => void
  onReset: () => void
}) {
  return (
    <div className="relative group">
      <MatchCard
        match={{
          id: playoff.id,
          player1_id: playoff.player1_id!,
          player2_id: playoff.player2_id!,
          score_p1: playoff.score_p1,
          score_p2: playoff.score_p2,
          is_completed: playoff.is_completed,
          round_number: 0,
          player1,
          player2,
        }}
        isAdmin={true}
        onEdit={() => !playoff.is_completed && onEdit()}
      />
      {playoff.is_completed && (
        <button
          onClick={onReset}
          className="absolute top-3 left-3 transition-opacity text-dc-muted hover:text-dc-red-light p-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
          title="Réinitialiser le score"
          aria-label="Réinitialiser le score"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
        </button>
      )}
      <p className={`text-xs mt-1 ml-1 ${playoff.stage === 'final' ? 'text-dc-gold/70' : 'text-dc-muted'}`}>
        {label}
      </p>
    </div>
  )
}
