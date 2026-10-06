'use client'

import { cardInfo, taxOf } from '@/lib/game/apply'
import { commanderPlace, frameOf, graveyardTail } from '@/lib/game/player-summary'
import type { Catalog, CardView, VisibleCard, ZoneRef } from '@/lib/game/types'
import Draggable from './Draggable'
import GameCard, { CardBack } from './GameCard'
import { longPressClass, menuGesture, type MenuPoint } from './touch'
import { cardProps, libraryTop, topId, useZone, type ZoneProps } from './zones'

/** Couleur du liseré d'une carte de la cascade, d'après ses couleurs. */
const FRAMES: Record<ReturnType<typeof frameOf>, string> = {
  W: '#d8d2bd', U: '#3a6ea5', B: '#3a3540', R: '#c4553b', G: '#3f7a4a', multi: '#c9a84c', land: '#8b6f4e', colorless: '#8a8a8a',
}

const visible = (cards: CardView[]) => cards.filter((c): c is VisibleCard => !c.hidden)

function frameColor(catalog: Catalog | undefined, card: VisibleCard): string {
  if (card.token) return FRAMES[frameOf(card.token.colors, card.token.typeLine)]
  const entry = card.ref === null ? undefined : catalog?.entries.find((e) => e.ref === card.ref)
  return entry ? FRAMES[frameOf(entry.en.colors, entry.en.type_line)] : FRAMES.colorless
}

const caseClass = 'min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1 text-dc-text'
const number = 'text-lg font-bold tabular-nums leading-none'
const label = 'text-[10px] leading-none text-dc-muted'

type PileProps = ZoneProps & {
  me: string | null
  onLibraryMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile') => void
  /** Pose `data-zone="hand"` sur la case Main (bandeau : aucune autre main affichée). */
  handZone?: boolean
}

/**
 * Quatre cases chiffrées : Main, Bib., Cim., Exil. Bib., Cim. et Exil acceptent le dépôt ;
 * la bibliothèque garde ses gestes (carte du dessus, double-clic pour piocher, menu au clic droit).
 */
export function PileCases(props: PileProps) {
  const { view, player, catalogs, lang, me, onLibraryMenu, onPile } = props
  const zones = view.players[player].zones
  const library = useZone({ player, zone: 'library' })
  const graveyard = useZone({ player, zone: 'graveyard' }, 'case')
  const exile = useZone({ player, zone: 'exile' })
  const libraryRef: ZoneRef = { player, zone: 'library' }
  const top = libraryTop(view, player)
  const canDrawTop = zones.library.count > 0 && player === me && props.interactive
  const hoverTop = top ? (h: boolean) => props.handlers.onHover(h ? top.id : null) : undefined
  const face = zones.library.count === 0
    ? <div className="h-full aspect-[63/88] rounded-[6%] border border-dashed border-dc-border" />
    : top ? <GameCard card={top} catalog={catalogs[top.owner]} lang={lang} className="h-full" /> : <CardBack className="h-full" bare />

  return (
    <div className="grid grid-cols-4 gap-1">
      <div className={`${caseClass} border-dc-border bg-dc-bg/60`} {...(props.handZone ? { 'data-zone': 'hand', 'data-player': player } : {})}>
        <span className={number} data-testid="hand-count">{zones.hand.length}</span>
        <span className={label}>Main</span>
      </div>
      <div
        ref={library.setNodeRef}
        data-zone="library" data-player={player} data-count={zones.library.count}
        className={`${caseClass} border-dc-border bg-dc-bg/60 cursor-context-menu ${longPressClass} ${library.highlight}`}
        title="Bibliothèque"
        {...menuGesture(onLibraryMenu)}
      >
        <span className="flex items-center gap-1">
          <span className="h-6 shrink-0">
            {canDrawTop ? (
              <Draggable id={topId(player)} from={libraryRef} className="h-full" onDoubleClick={() => props.handlers.onDoubleClick(topId(player), libraryRef)} onHover={hoverTop}>
                {face}
              </Draggable>
            ) : (
              <span className="block h-full" onMouseEnter={() => hoverTop?.(true)} onMouseLeave={() => hoverTop?.(false)}>{face}</span>
            )}
          </span>
          <span className={number}>{zones.library.count}</span>
        </span>
        <span className={label}>Bib.</span>
      </div>
      <button ref={graveyard.setNodeRef} className={`${caseClass} border-dc-gold/50 bg-dc-gold/10 ${graveyard.highlight}`} onClick={() => onPile('graveyard')} title="Cimetière">
        <span className={`${number} text-dc-gold-light`}>{zones.graveyard.length}</span>
        <span className={label}>Cim.</span>
      </button>
      <button ref={exile.setNodeRef} data-zone="exile" data-player={player} data-count={zones.exile.length}
        className={`${caseClass} border-dc-border bg-dc-bg/60 ${exile.highlight}`} onClick={() => onPile('exile')} title="Exil">
        <span className={number}>{zones.exile.length}</span>
        <span className={label}>Exil</span>
      </button>
    </div>
  )
}

/** Décalage d'un commandant sur le précédent, en largeur de carte. */
const COMMANDER_SHIFT = 0.4

/**
 * Zone de commandement en petite vignette (cible de dépôt, commandants déplaçables avec leur taxe),
 * puis, pour chaque commandant du joueur, son nom, où il se trouve et sa taxe.
 */
export function CommandBlock(props: ZoneProps) {
  const { view, player, catalogs, lang } = props
  const ref: ZoneRef = { player, zone: 'command' }
  const { setNodeRef, highlight } = useZone(ref)
  const inZone = visible(view.players[player].zones.command)
  const span = 1 + COMMANDER_SHIFT * Math.max(0, inZone.length - 1)
  const mine: VisibleCard[] = []
  for (const p of Object.values(view.players)) {
    const { library: _, ...zones } = p.zones
    for (const cards of Object.values(zones)) for (const c of visible(cards)) if (c.isCommander && c.owner === player) mine.push(c)
  }

  return (
    <div ref={setNodeRef} data-zone="command" data-player={player} data-count={view.players[player].zones.command.length}
      className={`flex items-center gap-2 rounded-md border border-dc-border bg-dc-bg/60 p-0.5 ${highlight}`}>
      <div className="relative h-8 shrink-0" style={{ aspectRatio: `${63 * span} / 88` }}>
        {inZone.length === 0 && <div className="h-full aspect-[63/88] rounded-[6%] border border-dashed border-dc-border" />}
        {inZone.map((card, i) => (
          <Draggable key={card.id} {...cardProps(card.id, ref, props)} className="absolute top-0 h-full" style={{ left: `${(i * COMMANDER_SHIFT * 100) / span}%` }}>
            <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} tax={taxOf(view, card.id)} className="h-full" />
          </Draggable>
        ))}
      </div>
      {mine.length > 0 && (
        <div className="min-w-0 flex flex-col gap-0.5">
          {mine.map((c) => (
            <div key={c.id} className="min-w-0 leading-tight">
              <div className="text-[11px] font-semibold text-dc-text truncate">{cardInfo(catalogs[c.owner], c, lang).name}</div>
              <div className="text-[10px] text-dc-muted truncate">
                {commanderPlace(view, c.id)}{taxOf(view, c.id) > 0 && <span className="text-dc-gold"> · Taxe : +{taxOf(view, c.id)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Cimetière en cascade : les 6 dernières cartes, nom lisible, la plus récente en bas ; quand la hauteur manque,
 * les plus anciennes sortent par le haut. Cible de dépôt ; un clic ouvre tout le cimetière.
 */
export function GraveyardCascade(props: ZoneProps & { onOpen: () => void; className?: string }) {
  const { view, player, catalogs, lang } = props
  const ref: ZoneRef = { player, zone: 'graveyard' }
  const { setNodeRef, highlight } = useZone(ref)
  const all = view.players[player].zones.graveyard
  const tail = graveyardTail(all)
  return (
    <div ref={setNodeRef} data-zone="graveyard" data-player={player} data-count={all.length}
      className={`min-h-0 flex flex-col rounded-md border border-dc-border bg-dc-bg/60 p-1 cursor-pointer ${highlight} ${props.className ?? ''}`}
      onClick={props.onOpen} title="Voir tout le cimetière" aria-label={`Cimetière : ${all.length} carte${all.length > 1 ? 's' : ''}`}>
      {/* Pas de titre : le nombre est déjà dans la case Cim., la place va aux noms. */}
      {tail.length === 0 && <span className="text-[11px] text-dc-muted">Cimetière vide</span>}
      <div className="flex-1 min-h-0 flex flex-col justify-end overflow-hidden">
        {tail.map((card) => (
          <Draggable key={card.id} {...cardProps(card.id, ref, props)} className="shrink-0 -mt-0.5 first:mt-0">
            <div className="truncate rounded-t px-1.5 py-px border-2 border-b-0 bg-[#f3efe2] text-[11px] leading-[14px] font-semibold text-black shadow-[0_-2px_4px_rgba(0,0,0,0.5)]"
              style={{ borderColor: frameColor(catalogs[card.owner], card) }}>
              {cardInfo(catalogs[card.owner], card, lang).name}
            </div>
          </Draggable>
        ))}
      </div>
    </div>
  )
}
