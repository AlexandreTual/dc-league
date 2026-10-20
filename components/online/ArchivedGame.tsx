import Link from 'next/link'
import type { GameTable } from '@/lib/db-games'
import { formatDuration } from '@/lib/game/clock'

const smallButton = 'px-3 py-1.5 rounded-lg text-sm border border-dc-gold/40 text-dc-gold bg-dc-gold/10 hover:bg-dc-gold/20'

/** Partie finie dont le plateau n'est plus gardé par le serveur de jeu : ce qu'en garde l'historique. */
export default function ArchivedGame({ table }: { table: GameTable }) {
  const winner = table.players.find((p) => p.playerId === table.winnerPlayerId)
  return (
    <div className="max-w-md mx-auto py-16 px-4 flex flex-col gap-4" data-testid="archived-game">
      <h1 className="text-xl text-dc-gold">Partie terminée</h1>
      <p className="text-dc-muted text-sm">Le plateau n’est plus disponible ; voici ce qu’en garde l’historique.</p>
      <p className="text-dc-text">
        {winner ? <>Vainqueur : <strong>{winner.name}</strong></> : 'Pas de vainqueur'}
        {table.durationSeconds !== null && <> · durée {formatDuration(table.durationSeconds * 1000)}</>}
      </p>
      <ul className="flex flex-col gap-1 text-sm">
        {table.players.map((p) => (
          <li key={p.playerId} className="text-dc-text">
            {p.name}{p.deckName && <span className="text-dc-muted"> — {p.deckName}</span>}
          </li>
        ))}
      </ul>
      <Link className={`${smallButton} self-start`} href="/salon">Retour au salon</Link>
    </div>
  )
}
