'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { mergeCards, type CardDataMap, type ClientMessage, type ServerMessage, type ViewMessage } from '@/lib/game/room'

/** Délais de reconnexion successifs (ms) ; le dernier se répète. Remis à zéro après une connexion réussie. */
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000]
const ERROR_VISIBLE_MS = 4000

export type SocketStatus = 'connecting' | 'open' | 'reconnecting'

/** Connexion en direct à une partie : dernière vue reçue, données de cartes cumulées, envoi de messages. */
export function useGameSocket(tableId: string) {
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const [last, setLast] = useState<ViewMessage | null>(null)
  const [cards, setCards] = useState<CardDataMap>({})
  const [error, setError] = useState<string | null>(null)
  const socket = useRef<WebSocket | null>(null)

  useEffect(() => {
    let attempt = 0
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let errorTimer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${scheme}://${window.location.host}/api/games/${tableId}/ws`)
      socket.current = ws
      ws.onopen = () => {
        attempt = 0
        setStatus('open')
      }
      ws.onmessage = (event) => {
        let message: ServerMessage
        try {
          message = JSON.parse(String(event.data))
        } catch {
          return
        }
        if (message.type === 'view') {
          setLast(message)
          setCards((prev) => mergeCards(prev, message.cards))
        } else {
          setError(message.error)
          clearTimeout(errorTimer)
          errorTimer = setTimeout(() => setError(null), ERROR_VISIBLE_MS)
        }
      }
      ws.onclose = () => {
        if (stopped) return
        setStatus('reconnecting')
        retryTimer = setTimeout(connect, RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)])
        attempt++
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      clearTimeout(errorTimer)
      socket.current?.close()
    }
  }, [tableId])

  const send = useCallback((message: ClientMessage) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message))
  }, [])

  return { status, last, cards, error, send }
}
