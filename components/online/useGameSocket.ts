'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toLocalClock, type LocalClock } from '@/lib/game/clock'
import { mergeCards, type CardDataMap, type ClientMessage, type RtcServerMessage, type ServerMessage, type ViewMessage } from '@/lib/game/room'
import { ERROR_VISIBLE_MS } from '@/components/table/source'
import { SOCKET_MSG, nextStep } from './reconnect'

/** `closed` : reconnexions abandonnées (voir `closedReason`) ; `retry()` relance. */
export type SocketStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

/** La table n'existe plus côté site (404) ; une erreur réseau ne permet pas de conclure. */
async function tableGone(tableId: string): Promise<boolean> {
  try {
    return (await fetch(`/api/games/${tableId}`)).status === 404
  } catch {
    return false
  }
}

/** Connexion en direct à une partie : dernière vue reçue, données de cartes cumulées, envoi de messages. */
export function useGameSocket(tableId: string) {
  const [status, setStatus] = useState<SocketStatus>('connecting')
  const [closedReason, setClosedReason] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)
  const [last, setLast] = useState<ViewMessage | null>(null)
  const [clock, setClock] = useState<LocalClock | undefined>(undefined)
  const [cards, setCards] = useState<CardDataMap>({})
  const [error, setError] = useState<string | null>(null)
  const socket = useRef<WebSocket | null>(null)
  const errorTimer = useRef<ReturnType<typeof setTimeout>>()
  /** Visio : abonnés à la signalisation reçue. */
  const rtcListeners = useRef(new Set<(message: RtcServerMessage) => void>())

  const showError = useCallback((message: string) => {
    setError(message)
    clearTimeout(errorTimer.current)
    errorTimer.current = setTimeout(() => setError(null), ERROR_VISIBLE_MS)
  }, [])

  useEffect(() => {
    let attempt = 0
    let lostSince: number | null = null
    let stopped = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const connect = () => {
      const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${scheme}://${window.location.host}/api/games/${tableId}/ws`)
      socket.current = ws
      ws.onopen = () => {
        attempt = 0
        lostSince = null
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
          setClock(toLocalClock(message.clock, Date.now()))
          setCards((prev) => mergeCards(prev, message.cards))
        } else if (message.type === 'rtc') {
          for (const listener of rtcListeners.current) listener(message)
        } else if (message.type === 'rejected') {
          showError(message.error)
        }
      }
      ws.onclose = async (event) => {
        if (stopped) return
        lostSince ??= Date.now()
        setStatus('reconnecting')
        const gone = await tableGone(tableId)
        if (stopped) return
        const step = nextStep({ reason: event.reason, tableGone: gone }, lostSince, attempt, Date.now())
        if ('giveUp' in step) {
          setStatus('closed')
          setClosedReason(step.giveUp)
          return
        }
        retryTimer = setTimeout(connect, step.retryIn)
        attempt++
      }
    }

    connect()
    return () => {
      stopped = true
      clearTimeout(retryTimer)
      socket.current?.close()
    }
  }, [tableId, generation, showError])

  useEffect(() => () => clearTimeout(errorTimer.current), [])

  const send = useCallback((message: ClientMessage) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(message))
    else showError(SOCKET_MSG.offline)
  }, [showError])

  /** Relance la connexion après un abandon. */
  const retry = useCallback(() => {
    setClosedReason(null)
    setStatus('connecting')
    setGeneration((g) => g + 1)
  }, [])

  /** Visio : envoi silencieux (pas d'erreur affichée hors connexion : la signalisation repart à la reconnexion). */
  const sendRtc = useCallback((to: string | undefined, data: Record<string, unknown>) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(to === undefined ? { type: 'rtc', data } : { type: 'rtc', to, data }))
  }, [])

  const onRtc = useCallback((listener: (message: RtcServerMessage) => void) => {
    rtcListeners.current.add(listener)
    return () => { rtcListeners.current.delete(listener) }
  }, [])

  return { status, closedReason, last, clock, cards, error, send, retry, sendRtc, onRtc }
}
