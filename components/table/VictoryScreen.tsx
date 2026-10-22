'use client'

import { useEffect, useMemo } from 'react'
import { Trophy } from 'lucide-react'
import { cardInfo } from '@/lib/game/apply'
import { portraitCard } from '@/lib/game/player-summary'
import type { Catalog, PlayerView } from '@/lib/game/types'
import type { Lang } from './GameCard'

const COLORS = ['#c9a84c', '#f0d080', '#fff4d6', '#a8862f', '#e8c766']

/**
 * Victoire (partie en ligne terminée avec un gagnant) : portrait du gagnant (illustration de son commandant),
 * « Victoire de <nom> » et confettis dorés ; un clic ou une touche ferme. Mouvement réduit : sans confettis (CSS).
 */
export default function VictoryScreen({ view, winner, catalogs, lang, onClose, rematch }: {
  view: PlayerView
  winner: string
  catalogs: Record<string, Catalog>
  lang: Lang
  onClose: () => void
  /** Bouton de revanche (joueur assis d'une partie en ligne) ; absent : pas de bouton. */
  rematch?: { label: string; busy: boolean; onGo: () => void }
}) {
  const name = view.players[winner]?.name ?? '?'
  const portrait = portraitCard(view, winner)
  const image = portrait ? cardInfo(catalogs[portrait.owner], portrait, lang) : null
  const confetti = useMemo(() => Array.from({ length: 48 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.8,
    duration: 2.6 + Math.random() * 2,
    color: COLORS[i % COLORS.length],
    tilt: Math.random() * 360,
    wide: i % 3 === 0,
  })), [])

  useEffect(() => {
    // Entrée sur le bouton de revanche : la revanche, pas la fermeture.
    const close = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-testid="victory-rematch"]')) return
      onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 overflow-hidden fx-fade-in" onClick={onClose}
      role="dialog" aria-label={`Victoire de ${name}`} data-testid="victory">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {confetti.map((c, i) => (
          <span key={i} className="fx-confetti absolute top-0 rounded-sm" style={{
            left: `${c.left}%`, width: c.wide ? 10 : 6, height: c.wide ? 6 : 12, background: c.color,
            animationDelay: `${c.delay}s`, animationDuration: `${c.duration}s`, rotate: `${c.tilt}deg`,
          }} />
        ))}
      </div>
      <div className="fx-victory relative flex flex-col items-center gap-3 px-8 py-6 rounded-2xl bg-dc-surface/95 border-2 border-dc-gold shadow-gold text-center">
        <Trophy className="w-8 h-8 text-dc-gold" />
        {image && !image.hidden && image.image ? (
          <div className="w-28 h-28 rounded-full border-4 border-dc-gold bg-dc-bg bg-no-repeat" title={image.name}
            style={{ backgroundImage: `url(${image.image})`, backgroundSize: '160% auto', backgroundPosition: '50% 20%' }} />
        ) : (
          <div className="w-28 h-28 rounded-full border-4 border-dc-gold bg-dc-purple flex items-center justify-center font-fantasy text-5xl text-dc-gold">{name.slice(0, 1).toUpperCase()}</div>
        )}
        <p className="font-fantasy text-2xl text-dc-gold">Victoire de {name}</p>
        {rematch && (
          <button className="px-4 py-2 rounded-lg text-sm border border-dc-gold/60 text-dc-gold bg-dc-gold/15 hover:bg-dc-gold/25 disabled:opacity-40"
            disabled={rematch.busy} onClick={(e) => { e.stopPropagation(); rematch.onGo() }} data-testid="victory-rematch">
            {rematch.label}
          </button>
        )}
        <p className="text-xs text-dc-muted">Toucher pour fermer</p>
      </div>
    </div>
  )
}
