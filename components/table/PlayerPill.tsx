'use client'

import { useEffect, useState } from 'react'
import { Crown, Heart, MoreHorizontal } from 'lucide-react'
import { cardInfo } from '@/lib/game/apply'
import { playerBadges } from '@/lib/game/player-badges'
import type { ClientAction } from '@/lib/game/room'
import type { Catalog, PlayerView } from '@/lib/game/types'
import type { Lang } from './GameCard'
import PlayerPanel, { opposingCommanders, Stepper } from './PlayerPanel'

const BADGE_COLORS = { normal: 'text-dc-text', warn: 'text-dc-gold', lethal: 'text-dc-red-light font-semibold' }

/**
 * Pastille d'un joueur : nom, vie ±, badges des compteurs non nuls ; « ⋯ » ouvre la bulle
 * avec tous les réglages (le panneau de joueur complet). Échap ou un clic à côté la ferme.
 */
export default function PlayerPill(props: {
  view: PlayerView
  player: string
  catalogs: Record<string, Catalog>
  lang: Lang
  host?: string
  online?: string[]
  canAct: boolean
  send: (action: ClientAction) => void
  onTitleClick?: () => void
  /** Bulle au-dessus de la pastille (ma pastille, en bas de l'écran). */
  up?: boolean
}) {
  const { up = false, ...panelProps } = props
  const { view, player, catalogs, lang, host, online, canAct, send, onTitleClick } = panelProps
  const [open, setOpen] = useState(false)
  const p = view.players[player]
  const active = view.activePlayer === player
  const commanders = opposingCommanders(view, player)
  const commanderName = (id: string) => {
    const c = commanders.find((x) => x.id === id)
    return c ? cardInfo(catalogs[c.owner], c, lang).name : 'commandant'
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="relative inline-flex" data-panel={player}>
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs text-dc-text whitespace-nowrap
        ${active ? 'border-dc-gold/70 bg-dc-gold/10' : 'border-dc-border bg-dc-surface/70'} ${p.eliminated ? 'opacity-50' : ''}`}>
        {online && <span className={`w-2 h-2 rounded-full ${online.includes(player) ? 'bg-dc-green-light' : 'bg-dc-muted/40'}`} title={online.includes(player) ? 'en ligne' : 'hors ligne'} />}
        <button className={`font-semibold text-sm hover:text-dc-gold ${p.eliminated ? 'line-through' : ''}`} onClick={onTitleClick} disabled={!onTitleClick} data-testid="player-name">{p.name}</button>
        {host === player && <Crown className="w-3.5 h-3.5 text-dc-gold" aria-label="hôte" />}
        {p.eliminated && <span className="text-dc-red-light">éliminé</span>}
        {!p.kept && !p.eliminated && <span className="text-dc-muted italic">choisit sa main…</span>}
        <Stepper label={<Heart className="w-3.5 h-3.5 text-dc-red-light" />} value={p.life} alert={p.life <= 0} disabled={!canAct}
          onChange={(delta) => send({ type: 'life', target: player, delta })} testId="player-life" />
        {playerBadges(view, player, commanderName).map((b) => (
          <span key={b.key} className={BADGE_COLORS[b.level]} data-badge={b.key}>{b.label}</span>
        ))}
        <button className="p-0.5 rounded hover:bg-dc-border" aria-label={`Compteurs de ${p.name}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-[57]" onClick={() => setOpen(false)} />
          <div className={`absolute left-0 ${up ? 'bottom-full mb-1' : 'top-full mt-1'} z-[58] w-[24rem] max-w-[90vw]`} data-bubble={player}>
            <PlayerPanel {...panelProps} />
          </div>
        </>
      )}
    </div>
  )
}
