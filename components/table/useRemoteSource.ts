'use client'

import { useMemo } from 'react'
import { useGameSocket } from '@/components/online/useGameSocket'
import { catalogsFrom, type GameSource } from './source'

/** Partie en ligne : la vue et les données de cartes arrivent par la connexion au serveur de jeu. */
export function useRemoteSource(tableId: string): GameSource | null {
  const { status, last, cards, error, send } = useGameSocket(tableId)
  const catalogs = useMemo(() => catalogsFrom(cards), [cards])
  if (!last) return null
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
