'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Mic, MicOff, PhoneOff, Video, VideoOff, X } from 'lucide-react'
import { clampPanelWidth, loadPanelWidth, savePanelWidth, tileColumns } from '@/lib/visio/protocol'
import type { Visio } from './useVisio'

const iconButton =
  'flex items-center justify-center w-7 h-7 tablet:w-11 tablet:h-11 rounded-lg border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40 disabled:cursor-not-allowed'

/** Vidéo d'un flux ; `muted` pour la mienne (pas d'écho), le son des autres passe par l'élément même réduit. */
function StreamVideo({ stream, muted, mirrored, hidden }: { stream: MediaStream | null; muted?: boolean; mirrored?: boolean; hidden?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const video = ref.current
    if (!video || video.srcObject === stream) return
    video.srcObject = stream
    if (stream) void video.play().catch(() => {})
  }, [stream])
  return (
    <video ref={ref} autoPlay playsInline muted={muted}
      className={`absolute inset-0 w-full h-full object-cover ${mirrored ? '-scale-x-100' : ''} ${hidden ? 'invisible' : ''}`} />
  )
}

/**
 * Fenêtre de visio, en haut à droite de la table : une vignette par joueur en visio, la mienne en incrustation.
 * Le coin en bas à gauche se tire pour l'agrandir ou la réduire (largeur retenue par le navigateur) ;
 * « Réduire » ne garde que la barre (le son continue).
 */
export default function VisioPanel({ visio, names }: { visio: Visio; names: Record<string, string> }) {
  const [width, setWidth] = useState(() => loadPanelWidth(typeof window === 'undefined' ? undefined : window.localStorage))
  const [collapsed, setCollapsed] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; width: number; available: number } | null>(null)

  const available = () => panel.current?.offsetParent?.clientWidth ?? window.innerWidth
  // Toujours dans la place disponible (fenêtre du navigateur réduite).
  useEffect(() => {
    const fit = () => setWidth((w) => clampPanelWidth(w, available()))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, width, available: available() }
  }
  const onResizeMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    // Fenêtre accrochée à droite : tirer vers la gauche l'agrandit.
    setWidth(clampPanelWidth(d.width + d.x - e.clientX, d.available))
  }
  const onResizeEnd = () => {
    if (!drag.current) return
    drag.current = null
    savePanelWidth(window.localStorage, width)
  }

  const tiles = visio.remotes
  const columns = tileColumns(tiles.length)

  return (
    <div ref={panel} className="absolute top-2 right-2 z-40 rounded-xl border border-dc-gold/40 bg-dc-surface/95 shadow-xl overflow-hidden select-none"
      style={{ width }} data-testid="visio-panel" onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1 px-1.5 py-1">
        <span className="font-fantasy text-xs text-dc-gold mr-auto pl-1">Visio</span>
        <button className={iconButton} onClick={() => visio.setMic(!visio.mic)} disabled={!visio.hasMic}
          aria-label={visio.mic ? 'Couper le micro' : 'Activer le micro'} title={visio.mic ? 'Couper le micro' : 'Activer le micro'} data-testid="visio-mic">
          {visio.mic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-dc-red-light" />}
        </button>
        <button className={iconButton} onClick={() => visio.setCam(!visio.cam)} disabled={!visio.hasCam}
          aria-label={visio.cam ? 'Couper la caméra' : 'Activer la caméra'} title={visio.cam ? 'Couper la caméra' : 'Activer la caméra'} data-testid="visio-cam">
          {visio.cam ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5 text-dc-red-light" />}
        </button>
        <button className={iconButton} onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Agrandir la visio' : 'Réduire la visio'}
          title={collapsed ? 'Agrandir' : 'Réduire'} data-testid="visio-collapse">
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        <button className={`${iconButton} text-dc-red-light`} onClick={visio.leave} aria-label="Quitter la visio" title="Quitter la visio" data-testid="visio-leave">
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>

      {visio.notice && (
        <div className="flex items-start gap-1 px-2 pb-1 text-[11px] leading-snug text-dc-red-light" role="alert" data-testid="visio-notice">
          <span className="flex-1">{visio.notice}</span>
          <button onClick={visio.dismissNotice} aria-label="Fermer"><X className="w-3 h-3" /></button>
        </div>
      )}

      <div className={`relative ${collapsed ? 'h-0 overflow-hidden' : ''}`}>
        {tiles.length === 0 ? (
          <div className="relative aspect-[4/3] bg-black/60">
            <StreamVideo stream={visio.local} muted mirrored hidden={!visio.cam} />
            <span className="absolute inset-x-0 bottom-1 text-center text-[11px] text-dc-muted px-2" data-testid="visio-waiting">
              En attente des autres joueurs…
            </span>
          </div>
        ) : (
          <div className="relative grid gap-0.5 bg-black/60" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {tiles.map((r) => (
              <div key={r.peer} className="relative aspect-[4/3] bg-black" data-visio-tile={r.player}>
                <StreamVideo stream={r.stream} hidden={!r.cam} />
                {!r.cam && (
                  <span className="absolute inset-0 flex items-center justify-center font-fantasy text-2xl text-dc-gold/70">
                    {(names[r.player] ?? '?').slice(0, 1)}
                  </span>
                )}
                {r.state !== 'connected' && (
                  <span className="absolute inset-x-0 top-1 text-center text-[10px] text-dc-muted">
                    {r.state === 'failed' || r.state === 'disconnected' ? 'Connexion perdue…' : 'Connexion…'}
                  </span>
                )}
                <span className="absolute left-1 bottom-1 flex items-center gap-1 rounded bg-black/60 px-1 text-[10px] text-dc-text">
                  {!r.mic && <MicOff className="w-3 h-3 text-dc-red-light" />}
                  {names[r.player] ?? '?'}
                </span>
              </div>
            ))}
            {/* Ma vignette, en incrustation en bas à droite. */}
            {visio.cam && (
              <div className="absolute right-1 bottom-1 w-[28%] aspect-[4/3] rounded border border-dc-gold/40 overflow-hidden bg-black" data-testid="visio-self">
                <StreamVideo stream={visio.local} muted mirrored />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Coin à tirer pour changer la taille (bas à gauche : la fenêtre est accrochée à droite). */}
      {!collapsed && (
        <div className="absolute left-0 bottom-0 w-5 h-5 tablet:w-8 tablet:h-8 cursor-nesw-resize touch-none" data-testid="visio-resize"
          onPointerDown={onResizeStart} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} onPointerCancel={onResizeEnd}
          aria-label="Tirer pour changer la taille" title="Tirer pour changer la taille">
          <svg viewBox="0 0 10 10" className="absolute left-1 bottom-1 w-2.5 h-2.5 text-dc-gold/80" aria-hidden>
            <path d="M1 1 L1 9 L9 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      )}
    </div>
  )
}
