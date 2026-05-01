import { DbPlayoff, DbPlayer } from '@/lib/db'
import { CheckCircle, Clock, ExternalLink, Trophy, Award } from 'lucide-react'
import Image from 'next/image'

type DeckInfo = {
  deck_name: string | null
  commander_image_url: string | null
  moxfield_url: string | null
}

interface Props {
  playoffs: DbPlayoff[]
  playerMap: Record<string, DbPlayer>
  deckMap: Record<string, DeckInfo>
}

function PlayerSlot({
  playerId,
  playerMap,
  deckMap,
  score,
  isWinner,
  isLoser,
  label,
}: {
  playerId: string | null
  playerMap: Record<string, DbPlayer>
  deckMap: Record<string, DeckInfo>
  score: number | null
  isWinner: boolean
  isLoser: boolean
  label?: string
}) {
  const player = playerId ? playerMap[playerId] : null
  const deck = playerId ? deckMap[playerId] : null

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all ${
        !player
          ? 'border-dc-border/30 bg-dc-bg/30 border-dashed'
          : isWinner
          ? 'border-dc-gold/50 bg-dc-gold/8'
          : isLoser
          ? 'border-dc-border/30 bg-dc-bg/20 opacity-50'
          : 'border-dc-border bg-dc-bg/50'
      }`}
    >

      {/* Name + deck */}
      <div className="flex-1 min-w-0">
        <span
          className={`font-fantasy text-sm font-semibold truncate block ${
            !player ? 'text-dc-muted italic' : isWinner ? 'text-dc-gold' : 'text-dc-text'
          }`}
        >
          {player ? player.name : label ?? 'À déterminer'}
        </span>
        {deck?.deck_name && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-dc-muted text-xs italic truncate">{deck.deck_name}</span>
            {deck.moxfield_url && (
              <a
                href={deck.moxfield_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-dc-muted hover:text-dc-gold transition-colors shrink-0"
                title="Voir sur Moxfield"
              >
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Score */}
      {score !== null && (
        <span
          className={`font-fantasy font-bold text-xl shrink-0 ${
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
  deckMap,
  title,
  icon: Icon,
  accent,
}: {
  playoff: DbPlayoff | undefined
  playerMap: Record<string, DbPlayer>
  deckMap: Record<string, DeckInfo>
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
        accent ? `bg-dc-surface ${accent}` : 'bg-dc-surface border-dc-border'
      }`}
    >
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

      <PlayerSlot
        playerId={playoff?.player1_id ?? null}
        playerMap={playerMap}
        deckMap={deckMap}
        score={s1}
        isWinner={p1Won}
        isLoser={p2Won}
        label="Qualifié DF1"
      />

      <div className="text-center text-dc-muted/40 text-xs font-bold">vs</div>

      <PlayerSlot
        playerId={playoff?.player2_id ?? null}
        playerMap={playerMap}
        deckMap={deckMap}
        score={s2}
        isWinner={p2Won}
        isLoser={p1Won}
        label="Qualifié DF2"
      />
    </div>
  )
}

export default function PlayoffBracket({ playoffs, playerMap, deckMap }: Props) {
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

  const winnerId = final?.is_completed
    ? ((final.score_p1 ?? 0) > (final.score_p2 ?? 0) ? final.player1_id : final.player2_id)
    : null
  const winner = winnerId ? playerMap[winnerId] : null
  const winnerDeck = winnerId ? deckMap[winnerId] : null

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        {/* Demi-finales */}
        <div className="space-y-4 lg:col-span-1">
          <h2 className="text-dc-muted text-xs font-bold uppercase tracking-widest text-center">
            Demi-finales
          </h2>
          <MatchSlot playoff={semi1} playerMap={playerMap} deckMap={deckMap} title="Demi-finale 1 · 1er vs 4ème" icon={Trophy} />
          <MatchSlot playoff={semi2} playerMap={playerMap} deckMap={deckMap} title="Demi-finale 2 · 2ème vs 3ème" icon={Trophy} />
        </div>

        {/* Finale */}
        <div className="space-y-4 lg:col-span-1 flex flex-col justify-center">
          <h2 className="text-dc-muted text-xs font-bold uppercase tracking-widest text-center">
            Grande Finale
          </h2>
          {bothSemisDone ? (
            <MatchSlot playoff={final} playerMap={playerMap} deckMap={deckMap} title="Finale" icon={Trophy} accent="border-dc-gold/30 shadow-gold" />
          ) : (
            <div className="rounded-2xl border border-dc-border/30 border-dashed p-8 text-center text-dc-muted text-sm">
              <Trophy className="w-8 h-8 mx-auto mb-2 opacity-20" />
              En attente des demi-finales
            </div>
          )}
        </div>

        {/* Petite finale */}
        <div className="space-y-4 lg:col-span-1 flex flex-col justify-center">
          <h2 className="text-dc-muted text-xs font-bold uppercase tracking-widest text-center">
            3ème Place
          </h2>
          {bothSemisDone ? (
            <MatchSlot playoff={thirdPlace} playerMap={playerMap} deckMap={deckMap} title="Petite Finale" icon={Award} />
          ) : (
            <div className="rounded-2xl border border-dc-border/30 border-dashed p-8 text-center text-dc-muted text-sm">
              <Award className="w-8 h-8 mx-auto mb-2 opacity-20" />
              En attente des demi-finales
            </div>
          )}
        </div>
      </div>

      {/* Winner banner */}
      {winner && (
        <div className="mt-6 bg-dc-gold/10 border border-dc-gold/30 rounded-2xl p-6 shadow-gold">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            {winnerDeck?.commander_image_url && (
              <div className="shrink-0 w-24 rounded-xl overflow-hidden border-2 border-dc-gold/60 shadow-gold">
                <Image
                  src={winnerDeck.commander_image_url}
                  alt=""
                  width={192}
                  height={268}
                  className="w-full h-auto"
                  unoptimized
                />
              </div>
            )}
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                <Trophy className="w-5 h-5 text-dc-gold" />
                <p className="text-dc-muted text-sm">Champion de la ligue</p>
              </div>
              <p className="font-fantasy text-3xl font-bold text-dc-gold">{winner.name}</p>
              {winnerDeck?.deck_name && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-1">
                  <p className="text-dc-muted text-sm italic">{winnerDeck.deck_name}</p>
                  {winnerDeck.moxfield_url && (
                    <a href={winnerDeck.moxfield_url} target="_blank" rel="noopener noreferrer" className="text-dc-muted hover:text-dc-gold transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
