import { PlayerStats } from '@/lib/leaderboard'
import { ExternalLink, Trophy } from 'lucide-react'
import PlayerName from './PlayerName'

interface Props {
  players: (PlayerStats & { moxfield_url?: string | null; commander_image_url?: string | null })[]
  totalPlayers: number
}

const rankColors = ['rank-1', 'rank-2', 'rank-3']
const rankBg = [
  'bg-dc-gold/5 border-dc-gold/20',
  'bg-white/5 border-white/10',
  'bg-amber-900/10 border-amber-800/20',
]

export default function LeaderboardTable({ players, totalPlayers }: Props) {
  if (players.length === 0) {
    return (
      <div className="text-center py-20 text-dc-muted">
        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p>Aucun joueur inscrit pour le moment.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {players.map((player, index) => {
        const rank = index + 1
        const isTop4 = rank <= 4
        const diff = player.gw - player.gl

        return (
          <div
            key={player.id}
            className={`relative rounded-xl border p-4 md:p-5 transition-all ${
              rank <= 3 ? rankBg[rank - 1] : 'bg-dc-surface border-dc-border'
            } ${isTop4 ? 'shadow-card' : 'opacity-80'}`}
          >
            {/* Top 4 badge */}
            {isTop4 && (
              <div className="absolute -top-px left-4 h-0.5 w-24 bg-dc-gold/40 rounded" />
            )}

            <div className="flex items-center gap-4">
              {/* Rank */}
              <div className={`w-8 text-center font-fantasy font-bold text-lg shrink-0 ${rankColors[rank - 1] ?? 'text-dc-muted'}`}>
                {rank <= 3 ? (
                  <Trophy className={`w-5 h-5 mx-auto ${rankColors[rank - 1]}`} />
                ) : (
                  rank
                )}
              </div>

              {/* Avatar / Initials */}
              <div className="w-10 h-10 rounded-full bg-dc-border/60 border border-dc-border flex items-center justify-center shrink-0 overflow-hidden">
                {player.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={player.avatar_url} alt={player.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-dc-gold font-fantasy font-bold text-sm">
                    {player.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Name + Moxfield */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <PlayerName
                    name={player.name}
                    commanderImageUrl={player.commander_image_url}
                    className="font-fantasy font-semibold text-dc-text truncate"
                  />
                  {player.moxfield_url && (
                    <a
                      href={player.moxfield_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-dc-muted hover:text-dc-gold transition-colors shrink-0"
                      title="Voir le deck sur Moxfield"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <div className="text-dc-muted text-xs mt-0.5">
                  {player.played}/{totalPlayers - 1} matchs joués
                </div>
              </div>

              {/* Stats grid */}
              <div className="hidden sm:grid grid-cols-4 gap-4 text-center shrink-0">
                <div>
                  <div className="text-dc-green-light font-bold text-sm">{player.wins}</div>
                  <div className="text-dc-muted text-xs">V</div>
                </div>
                <div>
                  <div className="text-dc-muted font-bold text-sm">{player.draws}</div>
                  <div className="text-dc-muted text-xs">N</div>
                </div>
                <div>
                  <div className="text-dc-red-light font-bold text-sm">{player.losses}</div>
                  <div className="text-dc-muted text-xs">D</div>
                </div>
                <div>
                  <div className={`font-bold text-sm ${diff >= 0 ? 'text-dc-green-light' : 'text-dc-red-light'}`}>
                    {diff > 0 ? '+' : ''}{diff}
                  </div>
                  <div className="text-dc-muted text-xs">Diff</div>
                </div>
              </div>

              {/* Points */}
              <div className="text-right shrink-0 ml-2">
                <div className={`font-fantasy font-bold text-xl ${rank === 1 ? 'text-dc-gold' : 'text-dc-text'}`}>
                  {player.points}
                </div>
                <div className="text-dc-muted text-xs">pts</div>
              </div>
            </div>

            {/* Mobile stats row */}
            <div className="sm:hidden flex justify-around mt-3 pt-3 border-t border-dc-border/50 text-center">
              <div>
                <div className="text-dc-green-light font-bold text-sm">{player.wins}V</div>
              </div>
              <div>
                <div className="text-dc-muted font-bold text-sm">{player.draws}N</div>
              </div>
              <div>
                <div className="text-dc-red-light font-bold text-sm">{player.losses}D</div>
              </div>
              <div>
                <div className={`font-bold text-sm ${diff >= 0 ? 'text-dc-green-light' : 'text-dc-red-light'}`}>
                  Diff {diff > 0 ? '+' : ''}{diff}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <p className="text-center text-dc-muted text-xs pt-2">
        Top 4 qualifiés pour les demi-finales · Tri : Points puis différence de manches (GW−GL)
      </p>
    </div>
  )
}
