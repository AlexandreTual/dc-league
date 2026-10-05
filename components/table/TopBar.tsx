'use client'

import Link from 'next/link'
import { ArrowLeft, BookOpen, Heart, Minus, Plus, RotateCcw, SkipForward, Sparkles, Undo2 } from 'lucide-react'
import type { Lang } from './GameCard'

const btn = 'flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-dc-border rounded-lg text-dc-text hover:border-dc-gold/50 disabled:opacity-40 disabled:cursor-not-allowed'

export default function TopBar({ deckId, deckName, turn, life, lang, canUndo, onNextTurn, onLife, onLang, onUndo, onNewGame, onToken, onLog }: {
  deckId: string
  deckName: string
  turn: number
  life: number
  lang: Lang
  canUndo: boolean
  onNextTurn: () => void
  onLife: (delta: number) => void
  onLang: () => void
  onUndo: () => void
  onNewGame: () => void
  onToken?: () => void
  onLog?: () => void
}) {
  const step = (e: React.MouseEvent) => (e.shiftKey ? 5 : 1)
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-dc-border bg-dc-surface">
      <Link href={`/decks/${deckId}`} className={btn}><ArrowLeft className="w-3.5 h-3.5" /> {deckName}</Link>
      <span className="text-dc-gold font-fantasy text-sm ml-2" data-testid="turn">Tour {turn}</span>
      <button className={btn} onClick={onNextTurn} title="Tour suivant (N)"><SkipForward className="w-3.5 h-3.5" /> Tour suivant</button>
      <div className="flex items-center gap-1 ml-2">
        <button className={btn} onClick={(e) => onLife(-step(e))} aria-label="Perdre des points de vie"><Minus className="w-3.5 h-3.5" /></button>
        <span className="flex items-center gap-1 text-sm text-dc-text min-w-[3.5rem] justify-center" data-testid="life">
          <Heart className="w-3.5 h-3.5 text-dc-red-light" /> {life}
        </span>
        <button className={btn} onClick={(e) => onLife(step(e))} aria-label="Gagner des points de vie"><Plus className="w-3.5 h-3.5" /></button>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button className={btn} onClick={onLang} aria-label="Langue des cartes">
          <span className={lang === 'fr' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>FR</span>/
          <span className={lang === 'en' ? 'text-dc-gold font-semibold' : 'text-dc-muted'}>EN</span>
        </button>
        <button className={btn} onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /> Annuler</button>
        <button className={btn} onClick={onToken} disabled={!onToken}><Sparkles className="w-3.5 h-3.5" /> Jeton</button>
        <button className={btn} onClick={onLog} disabled={!onLog}><BookOpen className="w-3.5 h-3.5" /> Journal</button>
        <button className={btn} onClick={onNewGame}><RotateCcw className="w-3.5 h-3.5" /> Nouvelle partie</button>
      </div>
    </div>
  )
}
