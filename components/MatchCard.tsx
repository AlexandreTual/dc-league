import { Match, Player } from '@/lib/leaderboard'
import { CheckCircle, Clock } from 'lucide-react'
import PlayerName from './PlayerName'

interface Props {
  match: Match & { player1: Player; player2: Player }
  onEdit?: () => void
  isAdmin?: boolean
}

export default function MatchCard({ match, onEdit, isAdmin }: Props) {
  const completed = match.is_completed
  const s1 = match.score_p1 ?? 0
  const s2 = match.score_p2 ?? 0

  const p1Won = completed && s1 > s2
  const p2Won = completed && s2 > s1
  const isDraw = completed && s1 === s2

  return (
    <div
      className={`match-card rounded-xl border p-4 relative ${
        completed
          ? 'bg-dc-surface border-dc-border/60'
          : 'bg-dc-surface/50 border-dc-border border-dashed'
      } ${isAdmin && !completed ? 'cursor-pointer hover:border-dc-gold/40' : ''}`}
      onClick={isAdmin && !completed ? onEdit : undefined}
    >
      {/* Status badge */}
      <div className="absolute top-3 right-3">
        {completed ? (
          <CheckCircle className="w-4 h-4 text-dc-green-light opacity-70" />
        ) : (
          <Clock className="w-4 h-4 text-dc-muted opacity-60" />
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Player 1 */}
        <div className={`flex-1 text-right min-w-0 ${p1Won ? 'opacity-100' : p2Won ? 'opacity-50' : ''}`}>
          <PlayerName
            name={match.player1.name}
            commanderImageUrl={match.player1.commander_image_url ?? null}
            className={`font-fantasy font-semibold text-sm md:text-base ${p1Won ? 'text-dc-gold' : 'text-dc-text'}`}
          />
          {p1Won && (
            <div className="text-dc-green-light text-xs mt-0.5">Victoire</div>
          )}
        </div>

        {/* Score */}
        <div className="flex items-center gap-2 shrink-0">
          {completed ? (
            <>
              <span className={`font-fantasy text-xl font-bold w-6 text-center ${p1Won ? 'text-dc-gold' : 'text-dc-muted'}`}>{s1}</span>
              <span className="text-dc-border font-bold">—</span>
              <span className={`font-fantasy text-xl font-bold w-6 text-center ${p2Won ? 'text-dc-gold' : 'text-dc-muted'}`}>{s2}</span>
            </>
          ) : (
            <span className="text-dc-muted text-xs px-3 py-1 border border-dc-border/40 rounded">
              {isAdmin ? 'Saisir score' : 'À jouer'}
            </span>
          )}
        </div>

        {/* Player 2 */}
        <div className={`flex-1 min-w-0 ${p2Won ? 'opacity-100' : p1Won ? 'opacity-50' : ''}`}>
          <PlayerName
            name={match.player2.name}
            commanderImageUrl={match.player2.commander_image_url ?? null}
            className={`font-fantasy font-semibold text-sm md:text-base ${p2Won ? 'text-dc-gold' : 'text-dc-text'}`}
          />
          {p2Won && (
            <div className="text-dc-green-light text-xs mt-0.5">Victoire</div>
          )}
        </div>
      </div>

      {isDraw && (
        <div className="text-center text-dc-muted text-xs mt-2">Match nul</div>
      )}

      {/* Admin edit hint */}
      {isAdmin && !completed && (
        <div className="text-center text-dc-gold/40 text-xs mt-2">Cliquer pour saisir le score</div>
      )}
    </div>
  )
}
