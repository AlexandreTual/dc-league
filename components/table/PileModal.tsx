'use client'

import { useRef, useState } from 'react'
import { useDndMonitor, useDroppable, type DragMoveEvent } from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { CARD_TYPES, countByType, filterPile, type CardType } from '@/lib/game/card-types'
import { placeAt, shiftCard, syncOrder } from '@/lib/game/pile-order'
import type { Catalog, PlayerZone, Position, VisibleCard } from '@/lib/game/types'
import Draggable from './Draggable'
import GameCard, { type Lang } from './GameCard'
import { touchTarget } from './touch'
import { pileKey } from './zones'

/** Cible de dépôt d'une carte de la fenêtre (regard : réordonner), suivie de son identifiant. */
export const PILE_SLOT = 'pile-slot:'
/** Cible de dépôt de toute la fenêtre (regard) : lâchée entre deux cartes, la carte reste où elle est. */
export const PILE_PANEL = 'pile-panel'

/** Toute la fenêtre comme cible (regard, glisser en cours) : lâchée entre deux cartes, rien ne bouge. */
function PanelTarget({ enabled }: { enabled: boolean }) {
  const { setNodeRef } = useDroppable({ id: PILE_PANEL, data: { panel: true }, disabled: !enabled })
  return <div ref={setNodeRef} className="absolute inset-0 pointer-events-none" />
}

/** Position du pointeur pendant un glisser (souris ou doigt). */
function pointerOf(e: DragMoveEvent): { x: number; y: number } | null {
  const start = e.activatorEvent
  const point = 'touches' in start ? (start as TouchEvent).touches[0] : start as MouseEvent
  return point ? { x: point.clientX + e.delta.x, y: point.clientY + e.delta.y } : null
}

/** Une carte de la fenêtre ; en regard, pendant un glisser, aussi une cible pour réordonner. */
function PileCard({ card, slot, children }: { card: VisibleCard; slot: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${PILE_SLOT}${card.id}`, data: { slot: card.id }, disabled: !slot })
  return (
    <div ref={setNodeRef} className={`space-y-1.5 rounded-lg ${isOver ? 'ring-2 ring-dc-gold/60' : ''}`} data-pile-card={card.id}>
      {children}
    </div>
  )
}

const TARGETS: { label: string; to: PlayerZone; position?: Position }[] = [
  { label: 'Main', to: 'hand' },
  { label: 'Champ', to: 'battlefield' },
  { label: 'Cimetière', to: 'graveyard' },
  { label: 'Exil', to: 'exile' },
  { label: 'Dessus', to: 'library', position: 'top' },
  { label: 'Dessous', to: 'library', position: 'bottom' },
]

const TYPE_LABEL = Object.fromEntries(CARD_TYPES.map((t) => [t.type, t.label])) as Record<CardType, string>

/**
 * Fenêtre listant les cartes visibles d'une zone, avec un bouton par destination ; chaque carte se glisse aussi
 * directement sur une zone de la table (champ de bataille, main…) : la fenêtre s'efface pendant le glisser et revient après.
 * Une carte déplacée disparaît de la liste. Avec `onReorder` (regard), les cartes se réordonnent
 * en les glissant l'une sur l'autre ou avec les flèches ; la première est le dessus de la bibliothèque.
 * En regard, la fenêtre ne s'efface qu'une fois le pointeur sorti de son cadre.
 */
export default function PileModal({ title, player, zone, cards, searchable, shuffleDefault, catalogs, lang, readOnly = false, onMove, onReorder, onShuffleChange, onClose }: {
  title: string
  /** Joueur à qui est la pile. */
  player: string
  zone: PlayerZone
  cards: VisibleCard[]
  searchable: boolean
  shuffleDefault: boolean | null
  catalogs: Record<string, Catalog>
  lang: Lang
  /** Consultation seule (spectateur, partie finie) : pas de boutons de destination. */
  readOnly?: boolean
  onMove: (card: VisibleCard, to: PlayerZone, position?: Position) => void
  /** Ordre choisi des cartes encore affichées, à chaque changement. */
  onReorder?: (ids: string[]) => void
  /** Case « Mélanger en fermant » changée : la table s'en sert pour fermer avec Échap. */
  onShuffleChange?: (shuffle: boolean) => void
  onClose: (shuffle: boolean) => void
}) {
  const [moved, setMoved] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [types, setTypes] = useState<CardType[]>([])
  const [shuffle, setShuffle] = useState(shuffleDefault ?? false)

  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id))
  /** Carte de la fenêtre en cours de glisser ; `away` : la fenêtre est effacée (laisse voir la table). */
  const [dragged, setDragged] = useState<{ id: string; away: boolean } | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  const present = cards.filter((card) => !moved.has(card.id))
  const ordered = onReorder ? syncOrder(order, present.map((c) => c.id)) : null
  const remaining = ordered ? ordered.map((id) => present.find((c) => c.id === id)!) : present
  const reorder = (next: string[]) => {
    setOrder(next)
    onReorder?.(next)
  }
  useDndMonitor({
    onDragStart: (e) => {
      const id = e.active.data.current?.card
      // Hors regard, rien à viser dans la fenêtre : elle s'efface tout de suite.
      if (String(e.active.id) === pileKey(String(id))) setDragged({ id: String(id), away: !ordered })
    },
    onDragMove: (e) => {
      if (!dragged || dragged.away) return
      const at = pointerOf(e)
      const box = panel.current?.getBoundingClientRect()
      if (at && box && (at.x < box.left || at.x > box.right || at.y < box.top || at.y > box.bottom)) setDragged({ ...dragged, away: true })
    },
    onDragEnd: (e) => {
      const target = e.over?.data.current?.slot
      if (dragged && ordered && typeof target === 'string' && target !== dragged.id) reorder(placeAt(ordered, dragged.id, target))
      setDragged(null)
    },
    onDragCancel: () => setDragged(null),
  })
  const away = dragged?.away ?? false
  // Regard : tant que la carte glissée reste dans la fenêtre, ses cartes sont les seules cibles.
  const inPanel = !!ordered && !!dragged && !away
  const visible = filterPile(remaining, { text: filter, types }, catalogs)
  // Types présents dans la pile, plus ceux encore cochés dont la dernière carte vient de partir.
  const counts = countByType(remaining, catalogs)
  const typeButtons = [...counts, ...types.filter((t) => !counts.some((c) => c.type === t)).map((t) => ({ type: t, label: TYPE_LABEL[t], count: 0 }))]
  const toggle = (t: CardType) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  const chip = (active: boolean) =>
    `text-xs px-2 py-1 rounded-full border ${active ? 'border-dc-gold bg-dc-gold/15 text-dc-gold' : 'border-dc-border text-dc-text hover:border-dc-gold/50'}`

  return (
    // Posée sur la table (sous la barre du site) ; la liste défile dans la fenêtre, l'en-tête et les filtres restent visibles.
    <div className={`absolute inset-0 z-[55] bg-black/70 flex items-center justify-center p-3 sm:p-6 transition-opacity ${away ? 'opacity-0 pointer-events-none' : ''}`}
      onClick={() => onClose(shuffle)} data-pile-away={away || undefined}>
      <PanelTarget enabled={inPanel} />
      <div ref={panel} className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-5xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-dc-border">
          <h2 className="font-fantasy text-dc-gold">{title}</h2>
          {searchable && (
            <input autoFocus className="flex-1 min-w-[10rem] bg-dc-bg border border-dc-border rounded-lg px-3 py-1.5 text-sm text-dc-text" placeholder="Filtrer par nom (FR ou EN)…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          )}
          {shuffleDefault !== null && (
            <label className="flex items-center gap-1.5 text-xs text-dc-muted ml-auto">
              <input type="checkbox" checked={shuffle} onChange={(e) => { setShuffle(e.target.checked); onShuffleChange?.(e.target.checked) }} /> Mélanger en fermant
            </label>
          )}
          <button onClick={() => onClose(shuffle)} className="text-dc-muted hover:text-dc-text" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>
        {searchable && typeButtons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-dc-border" role="group" aria-label="Filtrer par type">
            <button className={chip(types.length === 0)} aria-pressed={types.length === 0} onClick={() => setTypes([])}>Tous</button>
            {typeButtons.map((t) => (
              <button key={t.type} className={chip(types.includes(t.type))} aria-pressed={types.includes(t.type)} onClick={() => toggle(t.type)}>
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        )}
        <div className="min-h-0 overflow-y-auto p-4 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4">
          {visible.length === 0 && <p className="text-dc-muted text-sm col-span-full">Aucune carte</p>}
          {visible.map((card, index) => (
            <PileCard key={card.id} card={card} slot={inPanel}>
              <Draggable id={card.id} dragKey={pileKey(card.id)} from={{ player, zone }} disabled={readOnly} touchScroll className="relative rounded-[6%]">
                <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} />
                {ordered && index === 0 && (
                  <span className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 rounded bg-dc-gold text-black text-[10px] font-semibold" data-pile-top>Dessus</span>
                )}
              </Draggable>
              {ordered && !readOnly && (
                <div className="flex justify-between">
                  <button className={`p-0.5 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-30 ${touchTarget}`} aria-label="Vers le dessus"
                    disabled={index === 0} onClick={() => reorder(shiftCard(ordered, card.id, -1))}><ChevronLeft className="w-4 h-4" /></button>
                  <button className={`p-0.5 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-30 ${touchTarget}`} aria-label="Vers le dessous"
                    disabled={index === ordered.length - 1} onClick={() => reorder(shiftCard(ordered, card.id, 1))}><ChevronRight className="w-4 h-4" /></button>
                </div>
              )}
              {!readOnly && <div className="grid grid-cols-3 gap-1">
                {TARGETS.filter((t) => !(t.to === zone && t.to !== 'library')).map((t) => (
                  <button
                    key={t.label}
                    className="text-[10px] px-1 py-0.5 [@media(pointer:coarse)]:min-h-8 rounded border border-dc-border text-dc-text hover:border-dc-gold/50"
                    onClick={() => {
                      onMove(card, t.to, t.position)
                      setMoved((prev) => new Set(prev).add(card.id))
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>}
            </PileCard>
          ))}
        </div>
      </div>
    </div>
  )
}
