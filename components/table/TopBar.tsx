'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Dices, Layers, Maximize, Minimize, RotateCcw, Settings, SkipForward, Sparkles, Undo2 } from 'lucide-react'
import { isFullscreen, toggleFullscreen } from './fullscreen'
import LanguageMenu from '@/components/i18n/LanguageMenu'
import { useT } from '@/components/i18n/I18nProvider'

export const barButton =
  'flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-dc-border rounded-lg text-dc-text hover:border-dc-gold/50 disabled:opacity-40 disabled:cursor-not-allowed tablet:min-h-11'

/**
 * Barre du haut de la table. En mode test : « Nouvelle partie » (la vie est dans ma colonne, la réserve de mana sur mon champ de bataille).
 * En ligne : joueur actif, « Piocher », et les commandes passées dans `extra` (abandon, hôte).
 */
export default function TopBar({ back, turn, activeName, timer, canAct, canUndo, canEndTurn, onNextTurn, onDraw, onUndo, onNewGame, onToken, onDice, onLog, onSettings, extra }: {
  back: { href: string; label: string }
  turn: number
  activeName?: string
  /** Minuteur (en ligne). */
  timer?: React.ReactNode
  canAct: boolean
  canUndo: boolean
  canEndTurn: boolean
  onNextTurn: () => void
  onDraw?: () => void
  onUndo: () => void
  onNewGame?: () => void
  onToken: () => void
  onDice: () => void
  onLog: () => void
  onSettings: () => void
  extra?: React.ReactNode
}) {
  const b = useT().table.bar
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-dc-border bg-dc-surface" data-testid="top-bar">
      <Link href={back.href} className={barButton}><ArrowLeft className="w-3.5 h-3.5" /> {back.label}</Link>
      <span className="text-dc-gold font-fantasy text-sm ml-2" data-testid="turn">{b.turn(turn)}</span>
      {activeName && <span className="text-xs text-dc-muted" data-testid="active-player">{b.activePlayer} <span className="text-dc-text">{activeName}</span></span>}
      {timer}
      <button className={barButton} onClick={onNextTurn} disabled={!canEndTurn} title={b.endTurnTitle}><SkipForward className="w-3.5 h-3.5" /> {b.endTurn}</button>
      {onDraw && <button className={barButton} onClick={onDraw} disabled={!canAct} title={b.drawTitle}><Layers className="w-3.5 h-3.5" /> {b.draw}</button>}
      <div className="flex flex-wrap items-center gap-2 ml-auto">
        <LanguageMenu buttonClass={barButton} />
        <button className={barButton} onClick={onUndo} disabled={!canUndo} title={b.undoTitle} aria-label={b.undo}><Undo2 className="w-3.5 h-3.5" /> <Label>{b.undo}</Label></button>
        <button className={barButton} onClick={onToken} disabled={!canAct} title={b.token} aria-label={b.token}><Sparkles className="w-3.5 h-3.5" /> <Label>{b.token}</Label></button>
        <button className={barButton} onClick={onDice} disabled={!canAct} title={b.dice} aria-label={b.dice}><Dices className="w-3.5 h-3.5" /> <Label>{b.dice}</Label></button>
        <button className={barButton} onClick={onLog} title={b.log} aria-label={b.log}><BookOpen className="w-3.5 h-3.5" /> <Label>{b.log}</Label></button>
        <button className={barButton} onClick={onSettings} title={b.settings} aria-label={b.settings}><Settings className="w-3.5 h-3.5" /> <Label>{b.settings}</Label></button>
        <FullscreenButton />
        {onNewGame && <button className={barButton} onClick={onNewGame}><RotateCcw className="w-3.5 h-3.5" /> {b.newGame}</button>}
        {extra}
      </div>
    </div>
  )
}

/**
 * Texte d'un bouton secondaire : masqué sous 1536 px pour que la barre (minuteur compris) tienne sur une ligne ;
 * le bouton garde alors son icône, son infobulle et son nom accessible.
 */
function Label({ children }: { children: React.ReactNode }) {
  return <span className="hidden 2xl:inline">{children}</span>
}

/** « Plein écran » (API du navigateur) ; suit l'état réel, y compris la sortie par Échap. */
function FullscreenButton() {
  const t = useT()
  const b = t.table.bar
  const [on, setOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const sync = () => setOn(isFullscreen(document))
    sync()
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 4000)
    return () => clearTimeout(timer)
  }, [error])

  const label = on ? b.exitFullscreen : b.fullscreen
  return (
    <>
      <button className={barButton} onClick={async () => setError(await toggleFullscreen(document, t))} data-testid="fullscreen" title={label} aria-label={label}>
        {on ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />} <Label>{label}</Label>
      </button>
      {error && <span className="text-xs text-dc-red-light" role="alert" data-testid="fullscreen-error">{error}</span>}
    </>
  )
}
