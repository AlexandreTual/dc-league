'use client'

import Link from 'next/link'
import { ArrowLeft, BookOpen, Layers, RotateCcw, Settings, SkipForward, Sparkles, Undo2 } from 'lucide-react'
import type { Lang } from './GameCard'

export const barButton =
  'flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-dc-border rounded-lg text-dc-text hover:border-dc-gold/50 disabled:opacity-40 disabled:cursor-not-allowed'

/**
 * Barre du haut de la table. En mode test : réserve de mana et « Nouvelle partie » (la vie est dans ma colonne).
 * En ligne : joueur actif, « Piocher », et les commandes passées dans `extra` (abandon, hôte).
 */
export default function TopBar({ back, turn, activeName, lang, canAct, canUndo, canEndTurn, onNextTurn, onDraw, onLang, onUndo, onNewGame, onToken, onLog, onSettings, mana, extra }: {
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
      <button className={barButton} onClick={onNextTurn} disabled={!canEndTurn} title="Tour suivant (N)"><SkipForward className="w-3.5 h-3.5" /> Tour suivant</button>
      {onDraw && <button className={barButton} onClick={onDraw} disabled={!canAct} title="Piocher (D)"><Layers className="w-3.5 h-3.5" /> Piocher</button>}
      {mana && <span className="text-xs text-dc-text ml-2">{mana}</span>}
      <div className="flex flex-wrap items-center gap-2 ml-auto">
        <button className={barButton} onClick={onLang} aria-label="Langue des cartes">
          <span className={lang === 'fr' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>FR</span>/
          <span className={lang === 'en' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>EN</span>
        </button>
        <button className={barButton} onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /> Annuler</button>
        <button className={barButton} onClick={onToken} disabled={!canAct}><Sparkles className="w-3.5 h-3.5" /> Jeton</button>
        <button className={barButton} onClick={onLog}><BookOpen className="w-3.5 h-3.5" /> Journal</button>
        <button className={barButton} onClick={onSettings}><Settings className="w-3.5 h-3.5" /> Réglages</button>
        {onNewGame && <button className={barButton} onClick={onNewGame}><RotateCcw className="w-3.5 h-3.5" /> Nouvelle partie</button>}
        {extra}
      </div>
    </div>
  )
}
