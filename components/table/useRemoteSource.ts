'use client'

import { useMemo } from 'react'
import { useGameSocket, type SocketStatus } from '@/components/online/useGameSocket'
import type { ClientMessage, ViewMessage } from '@/lib/game/room'
import { catalogsFrom, type GameSource } from './source'

/**
 * Partie en ligne : la vue et les données de cartes arrivent par la connexion au serveur de jeu.
 * `source` : null tant qu'aucune vue n'est reçue ; `closedReason` : message quand les reconnexions sont abandonnées.
 */
export function useRemoteSource(tableId: string): { source: GameSource | null; closedReason: string | null; retry(): void } {
  const { status, closedReason, last, cards, error, send, retry } = useGameSocket(tableId)
  const catalogs = useMemo(() => catalogsFrom(cards), [cards])
  return { source: last ? remoteSource(last, status, catalogs, error, send) : null, closedReason, retry }
}

function remoteSource(
  last: ViewMessage, status: SocketStatus, catalogs: GameSource['catalogs'], error: string | null, send: (m: ClientMessage) => void,
): GameSource {
  const me = last.view.me || null
  return {
    me,
    view: last.view,
    catalogs,
    send: (action) => send({ type: 'action', action }),
    undo: () => send({ type: 'undo' }),
    canUndo: last.view.canUndo,
    error,
    mode: 'online',
    online: {
      status,
      host: last.host,
      players: last.online,
      finished: last.finished,
      winner: last.winner,
      concede: () => send({ type: 'concede' }),
      hostCommands: me && me === last.host ? {
        passTurn: (target) => send({ type: 'host', op: 'passTurn', target }),
        eliminate: (target) => send({ type: 'host', op: 'eliminate', target }),
        close: () => send({ type: 'host', op: 'close' }),
      } : undefined,
    },
  }
}
