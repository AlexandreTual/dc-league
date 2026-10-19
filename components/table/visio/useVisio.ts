'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { DEFAULT_ICE_SERVERS } from '@/lib/visio/ice'
import { VISIO_MSG, mediaErrorMessage } from '@/lib/visio/protocol'
import type { VisioChannel } from '../source'
import { VisioMesh, type Remote } from './mesh'

export type Visio = {
  inCall: boolean
  starting: boolean
  cam: boolean
  mic: boolean
  /** J'ai une caméra (ou un micro) à couper : sinon le bouton est grisé. */
  hasCam: boolean
  hasMic: boolean
  local: MediaStream | null
  remotes: Remote[]
  /** Joueurs en visio, moi compris si j'y suis. */
  presentPlayers: string[]
  notice: string | null
  join(): Promise<void>
  leave(): void
  setCam(on: boolean): void
  setMic(on: boolean): void
  dismissNotice(): void
}

/** Caméra et micro ; à défaut l'un des deux ; null si aucun (je vois et j'entends les autres sans être vu). */
async function getMedia(): Promise<{ stream: MediaStream | null; notice: string | null }> {
  if (!navigator.mediaDevices?.getUserMedia) return { stream: null, notice: VISIO_MSG.insecure }
  let first: unknown
  for (const constraints of [
    { video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } }, audio: { echoCancellation: true, noiseSuppression: true } },
    { audio: true },
    { video: true },
  ] as MediaStreamConstraints[]) {
    try {
      return { stream: await navigator.mediaDevices.getUserMedia(constraints), notice: null }
    } catch (e) {
      first ??= e
      // Refus de l'utilisateur : inutile de redemander avec moins.
      if ((e as { name?: string })?.name === 'NotAllowedError') break
    }
  }
  return { stream: null, notice: mediaErrorMessage(first) }
}

async function loadIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/visio/ice')
    const json = (await res.json()) as { iceServers?: RTCIceServer[] }
    return res.ok && Array.isArray(json.iceServers) && json.iceServers.length > 0 ? json.iceServers : DEFAULT_ICE_SERVERS
  } catch {
    return DEFAULT_ICE_SERVERS
  }
}

/**
 * Visio d'une partie en ligne. `channel` absent (mode test, spectateur, fenêtre à part, serveur plus ancien) : rien.
 * `me` : mon identifiant de joueur ; `online` : joueurs connectés (on oublie les autres) ; `status` : connexion au serveur.
 */
export function useVisio(channel: VisioChannel | undefined, me: string | null, online: string[], status: string): Visio {
  const [, render] = useReducer((n: number) => n + 1, 0)
  const [starting, setStarting] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const mesh = useRef<VisioMesh | null>(null)
  const ice = useRef<RTCIceServer[]>(DEFAULT_ICE_SERVERS)

  useEffect(() => {
    if (!channel || !me) return
    const m = new VisioMesh(channel, render, () => ice.current)
    mesh.current = m
    const unsubscribe = channel.subscribe((message) => m.receive(message))
    m.ask()
    const bye = () => m.leave()
    window.addEventListener('pagehide', bye)
    return () => {
      window.removeEventListener('pagehide', bye)
      m.leave()
      unsubscribe()
      mesh.current = null
    }
  }, [channel, me])

  // Après une reconnexion au serveur : je me réannonce (les connexions encore vivantes sont gardées).
  const wasOpen = useRef(status === 'open')
  useEffect(() => {
    if (status === 'open' && !wasOpen.current) {
      mesh.current?.ask()
      mesh.current?.announce()
    }
    wasOpen.current = status === 'open'
  }, [status])

  const onlineKey = online.join(',')
  useEffect(() => {
    mesh.current?.keepOnly(onlineKey.split(','))
  }, [onlineKey])

  const join = useCallback(async () => {
    const m = mesh.current
    if (!m || m.inCall || starting) return
    setStarting(true)
    setNotice(null)
    const [media, servers] = await Promise.all([getMedia(), loadIceServers()])
    ice.current = servers
    setStarting(false)
    if (mesh.current !== m) {
      for (const t of media.stream?.getTracks() ?? []) t.stop()
      return
    }
    setNotice(media.notice)
    m.join(media.stream)
  }, [starting])

  const m = mesh.current
  const presentPlayers = new Set(m ? [...m.present.values()].filter((p) => online.includes(p)) : [])
  if (m?.inCall && me) presentPlayers.add(me)
  return {
    inCall: m?.inCall ?? false,
    starting,
    cam: m?.cam ?? false,
    mic: m?.mic ?? false,
    hasCam: !!m?.localStream?.getVideoTracks().length,
    hasMic: !!m?.localStream?.getAudioTracks().length,
    local: m?.localStream ?? null,
    remotes: m?.remotes() ?? [],
    presentPlayers: [...presentPlayers],
    notice,
    join,
    leave: () => { setNotice(null); mesh.current?.leave() },
    setCam: (on) => mesh.current?.setCam(on),
    setMic: (on) => mesh.current?.setMic(on),
    dismissNotice: () => setNotice(null),
  }
}
