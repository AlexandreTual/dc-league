'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Mic, MicOff, PhoneOff, Video, VideoOff, X } from 'lucide-react'
import {
  clampPanelPosition, clampPanelWidth, loadPanelPosition, loadPanelWidth, savePanelPosition, savePanelWidth, tileColumns, VISIO_MSG,
  type PanelPosition,
} from '@/lib/visio/protocol'
import { useT } from '@/components/i18n/I18nProvider'
import type { Visio } from './useVisio'

const iconButton =
  'shrink-0 flex items-center justify-center w-7 h-7 tablet:w-11 tablet:h-11 rounded-lg border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40 disabled:cursor-not-allowed'

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

/** Zone de jeu dans laquelle la fenêtre se pose (son parent positionné). */
function areaOf(el: HTMLElement | null): { width: number; height: number } {
  const parent = el?.offsetParent
  return parent ? { width: parent.clientWidth, height: parent.clientHeight } : { width: window.innerWidth, height: window.innerHeight }
}

const sizeOf = (el: HTMLElement | null) => ({ width: el?.offsetWidth ?? 0, height: el?.offsetHeight ?? 0 })

/**
 * Fenêtre de visio, en haut à droite de la table au départ : une vignette par joueur en visio, la mienne en incrustation.
 * Sa barre se tire pour la poser où l'on veut dans la zone de jeu ; le coin en bas à gauche se tire pour l'agrandir
 * ou la réduire (place et largeur retenues par le navigateur) ; « Réduire » ne garde que la barre (le son continue).
 */
export default function VisioPanel({ visio, names }: { visio: Visio; names: Record<string, string> }) {
  const storage = () => (typeof window === 'undefined' ? undefined : window.localStorage)
  const [width, setWidth] = useState(() => loadPanelWidth(storage()))
  const [position, setPosition] = useState<PanelPosition>(() => loadPanelPosition(storage()))
  const [collapsed, setCollapsed] = useState(false)
  const t = useT()
  const v = t.table.visio
  // Message du navigateur (écrit en français par `useVisio`) : affiché dans la langue de l'interface s'il est connu.
  const noticeKey = (Object.keys(VISIO_MSG) as (keyof typeof VISIO_MSG)[]).find((k) => VISIO_MSG[k] === visio.notice)
  const notice = noticeKey ? v.notices[noticeKey] : visio.notice
  const panel = useRef<HTMLDivElement>(null)
  const resize = useRef<{ x: number; width: number; available: number } | null>(null)
  const move = useRef<{ x: number; y: number; from: PanelPosition } | null>(null)

  const area = () => areaOf(panel.current)
  const size = () => sizeOf(panel.current)

  // Toujours entière dans la zone de jeu : fenêtre du navigateur réduite, taille changée, fenêtre réduite ou rouverte.
  useEffect(() => {
    const fit = () => {
      setWidth((w) => clampPanelWidth(w, areaOf(panel.current).width))
      setPosition((p) => clampPanelPosition(p, sizeOf(panel.current), areaOf(panel.current)))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [width, collapsed, visio.remotes.length])

  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    resize.current = { x: e.clientX, width, available: area().width }
  }
  const onResizeMove = (e: React.PointerEvent) => {
    const d = resize.current
    if (!d) return
    // Fenêtre accrochée par son bord droit : tirer vers la gauche l'agrandit (et la décale si elle touche le bord gauche).
    setWidth(clampPanelWidth(d.width + d.x - e.clientX, d.available))
  }
  const onResizeEnd = () => {
    if (!resize.current) return
    resize.current = null
    savePanelWidth(window.localStorage, width)
    savePanelPosition(window.localStorage, position)
  }

  // Déplacement : on tire la barre, ailleurs que sur ses boutons.
  const onMoveStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    move.current = { x: e.clientX, y: e.clientY, from: position }
  }
  const onMoveMove = (e: React.PointerEvent) => {
    const d = move.current
    if (!d) return
    setPosition(clampPanelPosition({ right: d.from.right - (e.clientX - d.x), top: d.from.top + (e.clientY - d.y) }, size(), area()))
  }
  const onMoveEnd = () => {
    if (!move.current) return
    move.current = null
    savePanelPosition(window.localStorage, position)
  }

  const tiles = visio.remotes
  const columns = tileColumns(tiles.length)

  return (
    <div ref={panel} className="absolute z-40 rounded-xl border border-dc-gold/40 bg-dc-surface/95 shadow-xl overflow-hidden select-none"
      style={{ width, right: position.right, top: position.top }} data-testid="visio-panel" onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-1 px-1.5 py-1 cursor-move touch-none" data-testid="visio-bar" title="Tirer pour déplacer"
        onPointerDown={onMoveStart} onPointerMove={onMoveMove} onPointerUp={onMoveEnd} onPointerCancel={onMoveEnd}>
        <GripVertical className="w-3.5 h-3.5 text-dc-muted shrink-0" aria-hidden />
        <span className="font-fantasy text-xs text-dc-gold mr-auto truncate min-w-0">{v.title}</span>
        <button className={iconButton} onClick={() => visio.setMic(!visio.mic)} disabled={!visio.hasMic}
          aria-label={visio.mic ? v.micOff : v.micOn} title={visio.mic ? v.micOff : v.micOn} data-testid="visio-mic">
          {visio.mic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5 text-dc-red-light" />}
        </button>
        <button className={iconButton} onClick={() => visio.setCam(!visio.cam)} disabled={!visio.hasCam}
          aria-label={visio.cam ? v.camOff : v.camOn} title={visio.cam ? v.camOff : v.camOn} data-testid="visio-cam">
          {visio.cam ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5 text-dc-red-light" />}
        </button>
        <button className={iconButton} onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? v.expandAria : v.collapseAria}
          title={collapsed ? v.expand : v.collapse} data-testid="visio-collapse">
          {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </button>
        <button className={`${iconButton} text-dc-red-light`} onClick={visio.leave} aria-label={v.leave} title={v.leave} data-testid="visio-leave">
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>

      {visio.notice && (
        <div className="flex items-start gap-1 px-2 pb-1 text-[11px] leading-snug text-dc-red-light" role="alert" data-testid="visio-notice">
          <span className="flex-1">{notice}</span>
          <button onClick={visio.dismissNotice} aria-label={t.common.close}><X className="w-3 h-3" /></button>
        </div>
      )}

      <div className={`relative ${collapsed ? 'h-0 overflow-hidden' : ''}`}>
        {tiles.length === 0 ? (
          <div className="relative aspect-[4/3] bg-black/60">
            <StreamVideo stream={visio.local} muted mirrored hidden={!visio.cam} />
            <span className="absolute inset-x-0 bottom-1 text-center text-[11px] text-dc-muted px-2" data-testid="visio-waiting">
              {v.waiting}
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
                    {r.state === 'failed' || r.state === 'disconnected' ? v.lost : v.connecting}
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
          aria-label={v.resize} title={v.resize}>
          <svg viewBox="0 0 10 10" className="absolute left-1 bottom-1 w-2.5 h-2.5 text-dc-gold/80" aria-hidden>
            <path d="M1 1 L1 9 L9 9" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
      )}
    </div>
  )
}
