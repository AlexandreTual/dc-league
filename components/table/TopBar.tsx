'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Dices, Layers, Maximize, Minimize, MoreHorizontal, RotateCcw, Settings, SkipForward, Sparkles, Undo2 } from 'lucide-react'
import type { Lang } from './GameCard'
import { isFullscreen, toggleFullscreen } from './fullscreen'

export const barButton =
  'flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-dc-border rounded-lg text-dc-text hover:border-dc-gold/50 disabled:opacity-40 disabled:cursor-not-allowed tablet:min-h-11'

/**
 * Barre du haut de la table. En mode test : réserve de mana et « Nouvelle partie » (la vie est dans ma colonne).
 * En ligne : joueur actif, « Piocher », et les commandes passées dans `extra` (abandon, hôte).
 * Téléphone en vertical (mode test) : une seule ligne (retour, tour, « Fin de tour », mana) ; le reste dans le menu « ⋯ ».
 */
export default function TopBar({ back, turn, activeName, lang, canAct, canUndo, canEndTurn, onNextTurn, onDraw, onLang, onUndo, onNewGame, onToken, onDice, onLog, onSettings, mana, extra }: {
  back: { href: string; label: string }
  turn: number
  activeName?: string
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
  // Téléphone en vertical : les commandes secondaires sont rangées dans le menu « ⋯ ».
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])
  /** Une commande du menu « ⋯ » le referme. */
  const pick = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div ref={ref} className="relative flex flex-wrap phone:flex-nowrap items-center gap-2 px-3 py-2 border-b border-dc-border bg-dc-surface" data-testid="top-bar">
      <Link href={back.href} className={`${barButton} min-w-0`} aria-label={back.label}><ArrowLeft className="w-3.5 h-3.5 shrink-0" /> <span className="phone:hidden">{back.label}</span></Link>
      <span className="text-dc-gold font-fantasy text-sm ml-2 phone:ml-0 whitespace-nowrap" data-testid="turn">Tour {turn}</span>
      {activeName && <span className="text-xs text-dc-muted" data-testid="active-player">Joueur actif : <span className="text-dc-text">{activeName}</span></span>}
      <button className={`${barButton} whitespace-nowrap`} onClick={onNextTurn} disabled={!canEndTurn} title="Fin de tour (N)"><SkipForward className="w-3.5 h-3.5" /> Fin de tour</button>
      {onDraw && <button className={barButton} onClick={onDraw} disabled={!canAct} title="Piocher (D)"><Layers className="w-3.5 h-3.5" /> Piocher</button>}
      {mana && <span className="text-xs text-dc-text ml-2 phone:ml-0 min-w-0">{mana}</span>}
      <button className={`${barButton} hidden phone:flex ml-auto min-w-11 justify-center`} aria-label="Autres commandes" aria-expanded={open}
        onClick={() => setOpen((o) => !o)} data-testid="bar-more">
        <MoreHorizontal className="w-5 h-5" />
      </button>
      <div className={`flex flex-wrap items-center gap-2 ml-auto phone:absolute phone:top-full phone:right-2 phone:mt-1 phone:z-[59] phone:w-56 phone:flex-col phone:items-stretch phone:p-1.5 phone:rounded-xl phone:border phone:border-dc-border phone:bg-dc-surface phone:shadow-card ${open ? '' : 'phone:hidden'}`}
        data-testid="bar-menu">
        <button className={`${barButton} phone:order-last`} onClick={onLang} aria-label="Langue des cartes">
          <span className={lang === 'fr' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>FR</span>/
          <span className={lang === 'en' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>EN</span>
        </button>
        <button className={barButton} onClick={pick(onUndo)} disabled={!canUndo} title="Annuler (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /> Annuler</button>
        <button className={barButton} onClick={pick(onToken)} disabled={!canAct}><Sparkles className="w-3.5 h-3.5" /> Jeton</button>
        <button className={barButton} onClick={pick(onDice)} disabled={!canAct}><Dices className="w-3.5 h-3.5" /> Dés</button>
        <button className={barButton} onClick={pick(onLog)}><BookOpen className="w-3.5 h-3.5" /> Journal</button>
        <button className={barButton} onClick={pick(onSettings)}><Settings className="w-3.5 h-3.5" /> Réglages</button>
        <FullscreenButton onDone={() => setOpen(false)} />
        {onNewGame && <button className={barButton} onClick={pick(onNewGame)}><RotateCcw className="w-3.5 h-3.5" /> Nouvelle partie</button>}
        {extra}
      </div>
    </div>
  )
}

/** « Plein écran » (API du navigateur) ; suit l'état réel, y compris la sortie par Échap. */
function FullscreenButton({ onDone }: { onDone: () => void }) {
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

  return (
    <>
      <button className={barButton} onClick={async () => {
        const failed = await toggleFullscreen(document)
        setError(failed)
        // Le message d'erreur (navigateur sans plein écran) reste visible dans le menu « ⋯ ».
        if (!failed) onDone()
      }} data-testid="fullscreen">
        {on ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />} {on ? 'Quitter le plein écran' : 'Plein écran'}
      </button>
      {error && <span className="text-xs text-dc-red-light" role="alert" data-testid="fullscreen-error">{error}</span>}
    </>
  )
}
