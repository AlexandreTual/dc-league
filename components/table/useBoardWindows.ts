'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BOARD_WINDOW_HEARTBEAT_MS, boardWindowName, boardWindowUrl, channelName, detachedPlayers, isBoardWindowMessage, receive,
  type BoardWindowMessage, type DetachedState,
} from './boardWindows'

/** Ordinateur : pointeur précis et au moins 1024 px de large (ni téléphone ni tablette). */
const DESKTOP_QUERY = '(pointer: fine) and (min-width: 1024px)'

function useDesktop(): boolean {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || typeof BroadcastChannel === 'undefined') return
    const query = window.matchMedia(DESKTOP_QUERY)
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return desktop
}

export type BoardWindows = {
  /** Le bouton « Ouvrir dans une fenêtre » est proposé. */
  canDetach: boolean
  /** Adversaires dont le plateau est dans une fenêtre ouverte. */
  detached: string[]
  /** Adversaire dont la fenêtre a été bloquée par le navigateur. */
  blocked: string | null
  open(player: string): void
  bring(player: string): void
  dismissBlocked(): void
  url(player: string): string
}

/** Côté table : ouvrir le plateau d'un adversaire dans une fenêtre, savoir lesquelles sont ouvertes, les ramener. */
export function useBoardWindows(tableId: string | null): BoardWindows {
  const desktop = useDesktop()
  const enabled = desktop && tableId !== null
  const [state, setState] = useState<DetachedState>({})
  const [now, setNow] = useState(() => Date.now())
  const [blocked, setBlocked] = useState<string | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    if (!enabled) return
    const ch = new BroadcastChannel(channelName(tableId))
    channel.current = ch
    ch.onmessage = (e: MessageEvent) => {
      if (isBoardWindowMessage(e.data)) setState((s) => receive(s, e.data, Date.now()))
    }
    ch.postMessage({ type: 'hello' } satisfies BoardWindowMessage)
    // Horloge : un plateau dont la fenêtre ne donne plus signe de vie revient sur la table.
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(timer)
      ch.close()
      channel.current = null
      setState({})
    }
  }, [enabled, tableId])

  const url = useCallback((player: string) => (tableId ? boardWindowUrl(tableId, player) : ''), [tableId])

  const open = useCallback((player: string) => {
    if (!tableId) return
    const w = window.open(boardWindowUrl(tableId, player), boardWindowName(player), 'popup,width=1200,height=800')
    if (!w) return setBlocked(player)
    setBlocked(null)
    w.focus()
    // Sorti tout de suite ; sans signal de la fenêtre (page qui ne charge pas), il revient après quelques secondes.
    const at = Date.now()
    setNow(at)
    setState((s) => receive(s, { type: 'open', player }, at))
  }, [tableId])

  const bring = useCallback((player: string) => {
    const msg: BoardWindowMessage = { type: 'return', player }
    channel.current?.postMessage(msg)
    setState((s) => receive(s, msg, Date.now()))
  }, [])

  return {
    canDetach: enabled,
    detached: enabled ? detachedPlayers(state, now) : [],
    blocked: enabled ? blocked : null,
    open,
    bring,
    dismissBlocked: () => setBlocked(null),
    url,
  }
}

/** Ferme la fenêtre ; si le navigateur refuse (fenêtre ouverte à la main), retour à la table. */
function closeSelf(tableId: string) {
  window.close()
  setTimeout(() => window.location.assign(`/tables/${encodeURIComponent(tableId)}`), 300)
}

/** Côté fenêtre : se signaler à la table tant que le plateau est affiché ; renvoie l'action « Ramener ». */
export function useBoardWindowAnnounce(tableId: string, player: string, active: boolean): () => void {
  const channel = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    if (!active || typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(channelName(tableId))
    channel.current = ch
    const post = (msg: BoardWindowMessage) => ch.postMessage(msg)
    const announce = () => post({ type: 'open', player })
    ch.onmessage = (e: MessageEvent) => {
      if (!isBoardWindowMessage(e.data)) return
      if (e.data.type === 'hello') announce()
      else if (e.data.type === 'return' && e.data.player === player) closeSelf(tableId)
    }
    announce()
    const timer = setInterval(announce, BOARD_WINDOW_HEARTBEAT_MS)
    const leave = () => post({ type: 'closed', player })
    window.addEventListener('pagehide', leave)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', leave)
      leave()
      ch.close()
      channel.current = null
    }
  }, [tableId, player, active])

  return useCallback(() => {
    channel.current?.postMessage({ type: 'closed', player } satisfies BoardWindowMessage)
    closeSelf(tableId)
  }, [tableId, player])
}
