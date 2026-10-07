'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Dices, Layers, Maximize, Minimize, RotateCcw, Settings, SkipForward, Sparkles, Undo2 } from 'lucide-react'
import type { Lang } from './GameCard'
import { isFullscreen, toggleFullscreen } from './fullscreen'

export const barButton =
  'flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-dc-border rounded-lg text-dc-text hover:border-dc-gold/50 disabled:opacity-40 disabled:cursor-not-allowed'

/**
 * Barre du haut de la table. En mode test : réserve de mana et « Nouvelle partie » (la vie est dans ma colonne).
 * En ligne : joueur actif, « Piocher », et les commandes passées dans `extra` (abandon, hôte).
 */
export default function TopBar({ back, turn, activeName, timer, lang, canAct, canUndo, canEndTurn, onNextTurn, onDraw, onLang, onUndo, onNewGame, onToken, onDice, onLog, onSettings, mana, extra }: {
  back: { href: string; label: string }
  turn: number
  activeName?: string
  /** Minuteur (en ligne). */
  timer?: React.ReactNode
  lang: Lang
  canAct: boolean
  canUndo: boolean
  canEndTurn: boolean
  onNextTurn: () => void
  onDraw?: () => void
  onLang: () => void
  onUndo: () => void
  onNewGame?: () => void
  onToken: () => void
  onDice: () => void
  onLog: () => void
  onSettings: () => void
  /** Ma réserve de mana (mode test ; en ligne, elle est dans mon panneau). */
  mana?: React.ReactNode
  extra?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-dc-border bg-dc-surface">
      <Link href={back.href} className={barButton}><ArrowLeft className="w-3.5 h-3.5" /> {back.label}</Link>
      <span className="text-dc-gold font-fantasy text-sm ml-2" data-testid="turn">Tour {turn}</span>
      {activeName && <span className="text-xs text-dc-muted" data-testid="active-player">Joueur actif : <span className="text-dc-text">{activeName}</span></span>}
      {timer}
      <button className={barButton} onClick={onNextTurn} disabled={!canEndTurn} title="Tour suivant (N)"><SkipForward className="w-3.5 h-3.5" /> Tour suivant</button>
      {onDraw && <button className={barButton} onClick={onDraw} disabled={!canAct} title="Piocher (D)"><Layers className="w-3.5 h-3.5" /> Piocher</button>}
      {mana && <span className="text-xs text-dc-text ml-2">{mana}</span>}
      <div className="flex flex-wrap items-center gap-2 ml-auto">
        <button className={barButton} onClick={onLang} aria-label="Langue des cartes">
          <span className={lang === 'fr' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>FR</span>/
          <span className={lang === 'en' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>EN</span>
        </button>
        <button className={barButton} onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)" aria-label="Annuler"><Undo2 className="w-3.5 h-3.5" /> <Label>Annuler</Label></button>
        <button className={barButton} onClick={onToken} disabled={!canAct} title="Jeton" aria-label="Jeton"><Sparkles className="w-3.5 h-3.5" /> <Label>Jeton</Label></button>
        <button className={barButton} onClick={onDice} disabled={!canAct} title="Dés" aria-label="Dés"><Dices className="w-3.5 h-3.5" /> <Label>Dés</Label></button>
        <button className={barButton} onClick={onLog} title="Journal" aria-label="Journal"><BookOpen className="w-3.5 h-3.5" /> <Label>Journal</Label></button>
        <button className={barButton} onClick={onSettings} title="Réglages" aria-label="Réglages"><Settings className="w-3.5 h-3.5" /> <Label>Réglages</Label></button>
        <FullscreenButton />
        {onNewGame && <button className={barButton} onClick={onNewGame}><RotateCcw className="w-3.5 h-3.5" /> Nouvelle partie</button>}
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

  const label = on ? 'Quitter le plein écran' : 'Plein écran'
  return (
    <>
      <button className={barButton} onClick={async () => setError(await toggleFullscreen(document))} data-testid="fullscreen" title={label} aria-label={label}>
        {on ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />} <Label>{label}</Label>
      </button>
      {error && <span className="text-xs text-dc-red-light" role="alert" data-testid="fullscreen-error">{error}</span>}
    </>
  )
}
