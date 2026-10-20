'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Crown, ExternalLink, Minus, MoreHorizontal, Plus } from 'lucide-react'
import { cardInfo } from '@/lib/game/apply'
import { playerBadges } from '@/lib/game/player-badges'
import { lifeLevel, portraitCard } from '@/lib/game/player-summary'
import type { ClientAction } from '@/lib/game/room'
import type { Catalog, PlayerView } from '@/lib/game/types'
import type { Pop, Pops } from '@/lib/game/player-fx'
import type { CardEffects } from '@/lib/table-settings'
import type { Lang } from './GameCard'
import PlayerPanel, { opposingCommanders } from './PlayerPanel'
import { touchTarget } from './touch'

const BADGE_COLORS = { normal: 'border-dc-border text-dc-text', warn: 'border-dc-gold/50 text-dc-gold', lethal: 'border-dc-red-light/60 text-dc-red-light font-semibold' }

const SIZES = {
  column: { portrait: 'w-11 h-11 tablet:w-10 tablet:h-10', life: 'text-[52px] tablet:text-[48px]', name: 'text-xs' },
  header: { portrait: 'w-8 h-8', life: 'text-[40px]', name: 'text-xs' },
}

/** −, + et « ⋯ » : petits à la souris ; sur tablette, en grand (44 px de haut) sur une rangée sous la ligne portrait. */
const lifeButton = `w-6 h-5 tablet:w-auto tablet:h-11 flex items-center justify-center rounded tablet:rounded-lg border border-dc-border bg-dc-border/50 hover:border-dc-gold/50 disabled:opacity-30 ${touchTarget}`
const lifeIcon = 'w-3 h-3 tablet:w-5 tablet:h-5'

/** Animations du portrait (spec `2026-10-20-player-animations-design.md`) : bulles d'écart, fissures qui s'ouvrent. */
export type PortraitFx = { effects: CardEffects; pops: Pops; cracking: Set<string> }

const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`)

/** Écart qui s'envole (relancé à chaque nouvel écart grâce à sa clé). */
function PopBubble({ pop, kind, className }: { pop: Pop; kind: 'life' | 'poison' | 'commander'; className: string }) {
  const text = kind === 'poison' ? `☠ ${signed(pop.delta)}` : kind === 'commander' ? `⚔ ${signed(pop.delta)}` : signed(pop.delta)
  const color = kind === 'poison' ? 'text-dc-green-light' : kind === 'commander' || pop.delta < 0 ? 'text-dc-red-light' : 'text-dc-green-light'
  return (
    <span key={pop.key} className={`fx-pop absolute pointer-events-none z-10 font-bold tabular-nums whitespace-nowrap drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${color} ${className}`}
      data-fx-pop={kind}>{text}</span>
  )
}

/** Fissures sur la ligne portrait d'un joueur éliminé ; `opening` : elles s'ouvrent (une fois). */
function Cracks({ opening }: { opening: boolean }) {
  return (
    <svg className={`absolute inset-0 w-full h-full pointer-events-none z-10 ${opening ? 'fx-crack-open' : ''}`} viewBox="0 0 100 40" preserveAspectRatio="none"
      data-fx-crack={opening ? 'opening' : 'static'} aria-hidden>
      <path d="M38 0 L42 9 L36 15 L45 22 L41 30 L47 40 M42 9 L55 12 L62 6 M45 22 L58 25 L66 33 L64 40 M36 15 L22 19 L14 27"
        fill="none" stroke="rgba(230,230,230,0.75)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" strokeLinejoin="bevel" />
    </svg>
  )
}

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
  /** Animations du joueur ; absent : aucune. */
  fx?: PortraitFx
}) {
  const { size, up = false, onDetach, fx, ...panelProps } = props
  const { view, player, catalogs, lang, host, online, canAct, send, onTitleClick } = panelProps
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ up: boolean; maxHeight?: number }>({ up })
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
  const lifePop = fx?.effects.life ? fx.pops[`${player}:life`] : undefined
  const poisonPop = fx?.effects.life ? fx.pops[`${player}:poison`] : undefined
  const commanderPop = fx?.effects.life ? fx.pops[`${player}:commander`] : undefined
  const fallen = p.eliminated && !!fx?.effects.elimination
  const lifeFx = lifePop ? (lifePop.delta < 0 ? 'fx-life-loss' : 'fx-life-gain') : ''

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

  // Bulle du côté demandé si elle y tient, sinon du côté où il y a le plus de place ; hauteur bornée à la place disponible (défilement).
  useLayoutEffect(() => {
    if (!open || !ref.current || !bubbleRef.current) return
    const rect = ref.current.getBoundingClientRect()
    const above = rect.top - 8
    const below = window.innerHeight - rect.bottom - 8
    const height = bubbleRef.current.scrollHeight
    const side = height <= (up ? above : below) ? up : above > below
    setPlace({ up: side, maxHeight: Math.max(120, side ? above : below) })
  }, [open, up])

  // Rang dans l'ordre du tour (1 = premier joueur), à partir de 2 joueurs.
  const rank = Object.keys(view.players).length > 1 ? (view.turnOrder?.indexOf(player) ?? -1) + 1 : 0

  return (
    <div className={`relative ${p.eliminated ? 'opacity-50' : ''} ${fallen ? 'grayscale' : ''}`} data-panel={player} ref={ref}>
      {/* Grille : portrait | nom | vie, puis −, + et « ⋯ » sous le nom (souris) ou sur toute la largeur (tablette). Un seul jeu de boutons. */}
      <div className={`relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-lg border-2 p-1 bg-dc-bg/60 ${active ? 'border-dc-gold/70' : 'border-dc-border'}`}>
        {fallen && <Cracks opening={!!fx?.cracking.has(player)} />}
        <div className={`relative ${s.portrait} row-span-2 tablet:row-span-1 shrink-0`} data-portrait-of={player}>
          {image && !image.hidden && image.image ? (
            <div className="w-full h-full rounded-md bg-dc-surface bg-no-repeat" title={image.name}
              style={{ backgroundImage: `url(${image.image})`, backgroundSize: '160% auto', backgroundPosition: '50% 20%' }} />
          ) : (
            <div className="w-full h-full rounded-md bg-dc-purple flex items-center justify-center font-fantasy text-dc-gold">{p.name.slice(0, 1).toUpperCase()}</div>
          )}
          {poisonPop && poisonPop.delta > 0 && (
            <span key={`drops-${poisonPop.key}`} className="absolute inset-0 pointer-events-none overflow-hidden rounded-md" aria-hidden>
              {[18, 48, 74].map((left, i) => <span key={left} className="fx-drop absolute top-0 w-1.5 h-2.5 rounded-b-full rounded-t-[40%] bg-dc-green-light"
                style={{ left: `${left}%`, animationDelay: `${i * 0.18}s` }} />)}
            </span>
          )}
          {commanderPop && commanderPop.delta > 0 && (
            <span key={`sword-${commanderPop.key}`} className="fx-sword absolute inset-0 flex items-center justify-center pointer-events-none text-dc-red-light text-2xl" aria-hidden>⚔</span>
          )}
          {poisonPop && <PopBubble pop={poisonPop} kind="poison" className="left-0 bottom-full text-xs" />}
          {commanderPop && <PopBubble pop={commanderPop} kind="commander" className={`${poisonPop ? 'left-full' : 'left-0'} bottom-full text-xs`} />}
        </div>
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
        <span className="relative col-start-3 row-start-1 row-span-2 tablet:row-span-1 flex justify-end">
          {lifePop && <span key={`halo-${lifePop.key}`} className={`fx-halo absolute -inset-2 rounded-full pointer-events-none ${lifePop.delta < 0 ? 'fx-halo-loss' : 'fx-halo-gain'}`} aria-hidden />}
          <span key={lifePop?.key ?? 0} className={`relative inline-block ${s.life} leading-none font-bold tabular-nums ${lifeLevel(p.life) === 'low' ? 'text-dc-red-light' : 'text-dc-text'} ${lifeFx}`}
            data-testid="player-life">{p.life}</span>
          {lifePop && <PopBubble pop={lifePop} kind="life" className="right-0 bottom-full text-lg" />}
        </span>
        <div className="col-start-2 row-start-2 tablet:col-start-1 tablet:col-span-3 flex tablet:grid tablet:grid-cols-[1fr_1fr_44px] items-center gap-1 text-dc-text">
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
        <div ref={bubbleRef} className={`absolute left-0 ${place.up ? 'bottom-full mb-1' : 'top-full mt-1'} z-[58] w-[24rem] max-w-[90vw] overflow-y-auto bg-dc-surface rounded-xl shadow-card`}
          style={{ maxHeight: place.maxHeight }} data-bubble={player}>
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
