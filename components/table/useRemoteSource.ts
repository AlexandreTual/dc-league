'use client'

import { useMemo } from 'react'
import { useGameSocket, type SocketStatus } from '@/components/online/useGameSocket'
import type { LocalClock } from '@/lib/game/clock'
import type { ClientMessage, ViewMessage } from '@/lib/game/room'
import { catalogsFrom, type GameSource, type VisioChannel } from './source'

/**
 * Partie en ligne : la vue et les données de cartes arrivent par la connexion au serveur de jeu.
 * `source` : null tant qu'aucune vue n'est reçue ; `closedReason` : message quand les reconnexions sont abandonnées.
 */
export function useRemoteSource(tableId: string): { source: GameSource | null; closedReason: string | null; retry(): void } {
  const { status, closedReason, last, clock, cards, error, send, retry, sendRtc, onRtc } = useGameSocket(tableId)
  const catalogs = useMemo(() => catalogsFrom(cards), [cards])
  const visio = useMemo<VisioChannel>(() => ({ send: sendRtc, subscribe: onRtc }), [sendRtc, onRtc])
  return { source: last ? remoteSource(tableId, last, clock, status, catalogs, error, send, last.visio ? visio : undefined) : null, closedReason, retry }
}

function remoteSource(
  tableId: string, last: ViewMessage, clock: LocalClock | undefined, status: SocketStatus, catalogs: GameSource['catalogs'], error: string | null, send: (m: ClientMessage) => void,
  visio: VisioChannel | undefined,
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
      tableId,
      status,
      host: last.host,
      players: last.online,
      finished: last.finished,
      winner: last.winner,
      clock,
      concede: () => send({ type: 'concede' }),
      ...(visio ? { visio } : {}),
      hostCommands: me && me === last.host ? {
        passTurn: (target) => send({ type: 'host', op: 'passTurn', target }),
        eliminate: (target) => send({ type: 'host', op: 'eliminate', target }),
        close: () => send({ type: 'host', op: 'close' }),
      } : undefined,
    },
  }
}
