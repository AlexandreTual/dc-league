'use client'

import { useEffect, useRef, useState } from 'react'
import { Crown, ExternalLink, Minus, MoreHorizontal, Plus } from 'lucide-react'
import { cardInfo } from '@/lib/game/apply'
import { playerBadges } from '@/lib/game/player-badges'
import { lifeLevel, portraitCard } from '@/lib/game/player-summary'
import type { ClientAction } from '@/lib/game/room'
import type { Catalog, PlayerView } from '@/lib/game/types'
import type { Lang } from './GameCard'
import PlayerPanel, { opposingCommanders } from './PlayerPanel'
import { touchTarget } from './touch'

const BADGE_COLORS = { normal: 'border-dc-border text-dc-text', warn: 'border-dc-gold/50 text-dc-gold', lethal: 'border-dc-red-light/60 text-dc-red-light font-semibold' }

const SIZES = {
  column: { portrait: 'w-11 h-11 tablet:w-10 tablet:h-10 phone:w-11 phone:h-11', life: 'text-[52px] tablet:text-[48px] phone:text-[34px]', name: 'text-xs' },
  header: { portrait: 'w-8 h-8', life: 'text-[40px]', name: 'text-xs' },
}

/**
 * −, + et « ⋯ » : petits à la souris ; sur tablette, en grand (44 px de haut) sur une rangée sous la ligne portrait ;
 * sur téléphone en vertical, carrés de 44 px au bout de la ligne portrait (une seule ligne).
 */
const lifeButton = `w-6 h-5 tablet:w-auto tablet:h-11 phone:w-11 flex items-center justify-center rounded tablet:rounded-lg border border-dc-border bg-dc-border/50 hover:border-dc-gold/50 disabled:opacity-30 ${touchTarget}`
const lifeIcon = 'w-3 h-3 tablet:w-5 tablet:h-5'

/**
 * Ligne portrait d'un joueur (colonne ou en-tête de bandeau) : portrait, nom, − et +, vie en gros chiffres
 * (en rouge à 10 ou moins), badges des compteurs non nuls ; « ⋯ » ouvre la bulle avec tous les réglages.
 */
export default function PlayerPortrait(props: {
  view: PlayerView
  player: string
  catalogs: Record<string, Catalog>
  lang: Lang
  host?: string
  online?: string[]
  canAct: boolean
  send: (action: ClientAction) => void
  onTitleClick?: () => void
  size: 'column' | 'header'
  /** Bulle au-dessus de la ligne (ma colonne, en bas de l'écran). */
  up?: boolean
  /** « Ouvrir dans une fenêtre » (adversaire, en ligne, sur ordinateur). */
  onDetach?: () => void
}) {
  const { size, up = false, onDetach, ...panelProps } = props
  const { view, player, catalogs, lang, host, online, canAct, send, onTitleClick } = panelProps
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const p = view.players[player]
  const active = view.activePlayer === player
  const s = SIZES[size]
  const commanders = view.format === 'commander' ? opposingCommanders(view, player) : []
  const commanderName = (id: string) => {
    const c = commanders.find((x) => x.id === id)
    return c ? cardInfo(catalogs[c.owner], c, lang).name : 'commandant'
  }
  const portrait = portraitCard(view, player)
  const image = portrait ? cardInfo(catalogs[portrait.owner], portrait, lang) : null
  const badges = playerBadges(view, player, commanderName)
  const step = (e: React.MouseEvent) => (e.shiftKey ? 5 : 1)

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

  // Rang dans l'ordre du tour (1 = premier joueur), à partir de 2 joueurs.
  const rank = Object.keys(view.players).length > 1 ? (view.turnOrder?.indexOf(player) ?? -1) + 1 : 0

  return (
    <div className={`relative ${p.eliminated ? 'opacity-50' : ''}`} data-panel={player} ref={ref}>
      {/* Grille : portrait | nom | vie, puis −, + et « ⋯ » sous le nom (souris), sur toute la largeur (tablette)
          ou au bout de la ligne (téléphone en vertical). Un seul jeu de boutons. */}
      <div className={`grid grid-cols-[auto_minmax(0,1fr)_auto] phone:grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 rounded-lg border-2 p-1 bg-dc-bg/60 ${active ? 'border-dc-gold/70' : 'border-dc-border'}`}>
        {image && !image.hidden && image.image ? (
          <div className={`${s.portrait} row-span-2 tablet:row-span-1 shrink-0 rounded-md bg-dc-surface bg-no-repeat`} title={image.name}
            style={{ backgroundImage: `url(${image.image})`, backgroundSize: '160% auto', backgroundPosition: '50% 20%' }} />
        ) : (
          <div className={`${s.portrait} row-span-2 tablet:row-span-1 shrink-0 rounded-md bg-dc-purple flex items-center justify-center font-fantasy text-dc-gold`}>{p.name.slice(0, 1).toUpperCase()}</div>
        )}
        <div className="col-start-2 row-start-1 min-w-0 flex flex-col gap-1">
          <div className={`flex items-center gap-1 ${s.name} text-dc-text min-w-0`}>
            {online && <span className={`w-2 h-2 shrink-0 rounded-full ${online.includes(player) ? 'bg-dc-green-light' : 'bg-dc-muted/40'}`} title={online.includes(player) ? 'en ligne' : 'hors ligne'} />}
            {rank > 0 && (
              <span className="shrink-0 min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full border border-dc-gold/50 text-dc-gold text-[10px] leading-none flex items-center justify-center tabular-nums"
                title={rank === 1 ? 'Premier joueur' : `${rank}e dans l'ordre du tour`} data-testid="turn-rank">{rank}</span>
            )}
            <button className={`font-semibold truncate hover:text-dc-gold ${p.eliminated ? 'line-through' : ''}`} onClick={onTitleClick} disabled={!onTitleClick} data-testid="player-name">{p.name}</button>
            {host === player && <Crown className="w-3.5 h-3.5 shrink-0 text-dc-gold" aria-label="hôte" />}
            {onDetach && (
              <button className="ml-auto shrink-0 text-dc-muted hover:text-dc-gold" onClick={onDetach} title="Ouvrir dans une fenêtre"
                aria-label={`Ouvrir le plateau de ${p.name} dans une fenêtre`} data-testid="detach">
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {p.eliminated && <span className="text-[10px] text-dc-red-light">éliminé</span>}
          {!p.kept && !p.eliminated && <span className="text-[10px] text-dc-muted italic">choisit sa main…</span>}
        </div>
        <span className={`col-start-3 row-start-1 row-span-2 tablet:row-span-1 ${s.life} leading-none font-bold tabular-nums ${lifeLevel(p.life) === 'low' ? 'text-dc-red-light' : 'text-dc-text'}`} data-testid="player-life">{p.life}</span>
        <div className="col-start-2 row-start-2 tablet:col-start-1 tablet:col-span-3 phone:col-start-4 phone:col-span-1 phone:row-start-1 flex tablet:grid tablet:grid-cols-[1fr_1fr_44px] phone:flex items-center gap-1 text-dc-text">
          <button className={lifeButton} disabled={!canAct} onClick={(e) => send({ type: 'life', target: player, delta: -step(e) })} aria-label="moins : points de vie"><Minus className={lifeIcon} /></button>
          <button className={lifeButton} disabled={!canAct} onClick={(e) => send({ type: 'life', target: player, delta: step(e) })} aria-label="plus : points de vie"><Plus className={lifeIcon} /></button>
          <button className={`${lifeButton} ml-auto tablet:ml-0`} aria-label={`Compteurs de ${p.name}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <MoreHorizontal className={lifeIcon} />
          </button>
        </div>
      </div>
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {badges.map((b) => (
            <span key={b.key} className={`text-[10px] px-1.5 rounded-full border bg-dc-bg/60 ${BADGE_COLORS[b.level]}`} data-badge={b.key}>{b.label}</span>
          ))}
        </div>
      )}
      {open && (
        <div className={`absolute left-0 ${up ? 'bottom-full mb-1' : 'top-full mt-1'} z-[58] w-[24rem] max-w-[90vw] bg-dc-surface rounded-xl shadow-card`} data-bubble={player}>
          <PlayerPanel {...panelProps} />
          {onDetach && (
            <button className="w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 border-t border-dc-border text-dc-text hover:text-dc-gold"
              onClick={() => { setOpen(false); onDetach() }} data-testid="detach-bubble">
              <ExternalLink className="w-3.5 h-3.5" /> Ouvrir dans une fenêtre
            </button>
          )}
        </div>
      )}
    </div>
  )
}
