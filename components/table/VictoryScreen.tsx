'use client'

import { useEffect, useMemo } from 'react'
import { Trophy } from 'lucide-react'
import { cardInfo } from '@/lib/game/apply'
import { portraitCard } from '@/lib/game/player-summary'
import type { Catalog, PlayerView } from '@/lib/game/types'
import type { Lang } from './GameCard'
import { useT } from '@/components/i18n/I18nProvider'

const COLORS = ['#c9a84c', '#f0d080', '#fff4d6', '#a8862f', '#e8c766']

/**
 * Victoire (partie en ligne terminée avec un gagnant) : portrait du gagnant (illustration de son commandant),
 * « Victoire de <nom> » et confettis dorés ; un clic ou une touche ferme. Mouvement réduit : sans confettis (CSS).
 */
export default function VictoryScreen({ view, winner, catalogs, lang, onClose }: {
  view: PlayerView
  winner: string
  catalogs: Record<string, Catalog>
  lang: Lang
  onClose: () => void
}) {
  const t = useT().table
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
    const close = () => onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/60 overflow-hidden fx-fade-in" onClick={onClose}
      role="dialog" aria-label={t.status.winner(name)} data-testid="victory">
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
        <p className="font-fantasy text-2xl text-dc-gold">{t.status.winner(name)}</p>
        <p className="text-xs text-dc-muted">{t.victory.close}</p>
      </div>
    </div>
  )
}
