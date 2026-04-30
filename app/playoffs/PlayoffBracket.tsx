import { DbPlayoff, DbPlayer } from '@/lib/db'
import { CheckCircle, Clock, Trophy, Award } from 'lucide-react'

interface Props {
  playoffs: DbPlayoff[]
  playerMap: Record<string, DbPlayer>
}

function PlayerSlot({
  playerId,
  playerMap,
  score,
  isWinner,
  isLoser,
  label,
}: {
  playerId: string | null
  playerMap: Record<string, DbPlayer>
  score: number | null
  isWinner: boolean
  isLoser: boolean
  label?: string
}) {
  const player = playerId ? playerMap[playerId] : null

  return (
    <div
      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
        !player
          ? 'border-dc-border/30 bg-dc-bg/30 border-dashed'
          : isWinner
          ? 'border-dc-gold/40 bg-dc-gold/5'
          : isLoser
          ? 'border-dc-border/30 bg-dc-bg/20 opacity-50'
          : 'border-dc-border bg-dc-bg/50'
      }`}
    >
      <span
        className={`font-fantasy text-sm font-semibold truncate ${
          !player
            ? 'text-dc-muted italic'
            : isWinner
            ? 'text-dc-gold'
            : 'text-dc-text'
        }`}
      >
        {player ? player.name : label ?? 'À déterminer'}
      </span>
      {score !== null && (
        <span
          className={`font-fantasy font-bold text-lg ml-2 shrink-0 ${
            isWinner ? 'text-dc-gold' : 'text-dc-muted'
          }`}
        >
          {score}
        </span>
      )}
    </div>
  )
}

function MatchSlot({
  playoff,
  playerMap,
  title,
  icon: Icon,
  accent,
}: {
  playoff: DbPlayoff | undefined
  playerMap: Record<string, DbPlayer>
  title: string
  icon: React.ElementType
  accent?: string
}) {
  const completed = playoff?.is_completed ?? false
  const s1 = playoff?.score_p1 ?? null
  const s2 = playoff?.score_p2 ?? null
  const p1Won = completed && (s1 ?? 0) > (s2 ?? 0)
  const p2Won = completed && (s2 ?? 0) > (s1 ?? 0)

  return (
    <div
      className={`rounded-2xl border p-4 space-y-2 ${
        accent
          ? `bg-dc-surface ${accent}`
          : 'bg-dc-surface border-dc-border'
      }`}
    >
      {/* Title */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${accent ? 'text-dc-gold' : 'text-dc-muted'}`} />
        <span className={`text-xs font-bold uppercase tracking-widest ${accent ? 'text-dc-gold' : 'text-dc-muted'}`}>
          {title}
        </span>
        <div className="ml-auto">
          {completed ? (
            <CheckCircle className="w-4 h-4 text-dc-green-light" />
          ) : playoff ? (
            <Clock className="w-4 h-4 text-dc-muted" />
          ) : null}
        </div>
      </div>

      {/* Player 1 */}
      <PlayerSlot
        playerId={playoff?.player1_id ?? null}
        playerMap={playerMap}
        score={s1}
        isWinner={p1Won}
        isLoser={p2Won}
        label="Qualifié DF1"
      />

      <div className="text-center text-dc-muted/40 text-xs font-bold">vs</div>

      {/* Player 2 */}
      <PlayerSlot
        playerId={playoff?.player2_id ?? null}
        playerMap={playerMap}
        score={s2}
        isWinner={p2Won}
        isLoser={p1Won}
        label="Qualifié DF2"
      />
    </div>
  )
}

export default function PlayoffBracket({ playoffs, playerMap }: Props) {
  if (playoffs.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <Trophy className="w-16 h-16 text-dc-muted mx-auto opacity-20" />
        <p className="text-dc-muted text-lg font-fantasy">Les playoffs n&apos;ont pas encore commencé</p>
        <p className="text-dc-muted text-sm">
          Les phases finales débuteront une fois tous les matchs de la ligue joués.
        </p>
      </div>
    )
  }

  const semi1      = playoffs.find((p) => p.stage === 'semi1')
  const semi2      = playoffs.find((p) => p.stage === 'semi2')
  const final      = playoffs.find((p) => p.stage === 'final')
  const thirdPlace = playoffs.find((p) => p.stage === 'third_place')

  const bothSemisDone = semi1?.is_completed && semi2?.is_completed

  return (
    <div className="space-y-6">
      {/* Mobile / Tablet: stacked layout */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        {/* Column 1: Demi-finales */}
        <div className="space-y-4 lg:col-span-1">
          <h2 className="text-dc-muted text-xs font-bold uppercase tracking-widest text-center">
            Demi-finales
          </h2>
          <MatchSlot
            playoff={semi1}
            playerMap={playerMap}
            title="Demi-finale 1 · 1er vs 4ème"
            icon={Trophy}
          />
          <MatchSlot
            playoff={semi2}
            playerMap={playerMap}
            title="Demi-finale 2 · 2ème vs 3ème"
            icon={Trophy}
          />
        </div>

        {/* Column 2: Finale */}
        <div className="space-y-4 lg:col-span-1 flex flex-col justify-center">
          <h2 className="text-dc-muted text-xs font-bold uppercase tracking-widest text-center">
            Grande Finale
          </h2>
          {bothSemisDone ? (
            <MatchSlot
              playoff={final}
              playerMap={playerMap}
              title="Finale"
              icon={Trophy}
              accent="border-dc-gold/30 shadow-gold"
            />
          ) : (
            <div className="rounded-2xl border border-dc-border/30 border-dashed p-8 text-center text-dc-muted text-sm">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20" />
              En attente des demi-finales
            </div>
          )}
        </div>

        {/* Column 3: Petite finale */}
        <div className="space-y-4 lg:col-span-1 flex flex-col justify-center">
          <h2 className="text-dc-muted text-xs font-bold uppercase tracking-widest text-center">
            3ème Place
          </h2>
          {bothSemisDone ? (
            <MatchSlot
              playoff={thirdPlace}
              playerMap={playerMap}
              title="Petite Finale"
              icon={Award}
            />
          ) : (
            <div className="rounded-2xl border border-dc-border/30 border-dashed p-8 text-center text-dc-muted text-sm">
              <Award className="w-8 h-8 mx-auto mb-2 opacity-20" />
              En attente des demi-finales
            </div>
          )}
        </div>
      </div>

      {/* Winner banner */}
      {final?.is_completed && (
        <div className="mt-6 text-center bg-dc-gold/10 border border-dc-gold/30 rounded-2xl p-6 shadow-gold">
          <Trophy className="w-10 h-10 text-dc-gold mx-auto mb-2" />
          <p className="text-dc-muted text-sm mb-1">Champion de la ligue</p>
          {(() => {
            const winnerId =
              (final.score_p1 ?? 0) > (final.score_p2 ?? 0)
                ? final.player1_id
                : final.player2_id
            const winner = winnerId ? playerMap[winnerId] : null
            return (
              <p className="font-fantasy text-2xl font-bold text-dc-gold">
                {winner?.name ?? '—'}
              </p>
            )
          })()}
        </div>
      )}
    </div>
  )
}
