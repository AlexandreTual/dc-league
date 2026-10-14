'use client'

import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { formatDuration, type LocalClock } from '@/lib/game/clock'

/**
 * Minuteur d'une partie en ligne : temps écoulé depuis le début et temps du tour en cours ; partie finie : durée figée.
 * Les instants viennent du serveur (déjà ramenés à l'horloge locale) : on ne fait qu'afficher le décompte.
 */
export default function GameTimer({ clock }: { clock: LocalClock }) {
  const [now, setNow] = useState(() => Date.now())
  const running = clock.finishedAt === undefined
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  const end = clock.finishedAt ?? now
  const game = clock.startedAt === undefined ? null : formatDuration(end - clock.startedAt)
  const turn = !running || clock.turnStartedAt === undefined ? null : formatDuration(now - clock.turnStartedAt)
  if (game === null && turn === null) return null
  return (
    <span className="flex items-center gap-1.5 text-xs text-dc-muted tabular-nums" data-testid="game-timer">
      <Timer className="w-3.5 h-3.5" />
      {game !== null && <span title={running ? 'Temps de partie' : 'Durée de la partie'} data-testid="game-time">{running ? '' : 'Durée '}<span className="text-dc-text">{game}</span></span>}
      {turn !== null && <span title="Temps du tour en cours" data-testid="turn-time">{game !== null && '· '}tour <span className="text-dc-text">{turn}</span></span>}
    </span>
  )
}
