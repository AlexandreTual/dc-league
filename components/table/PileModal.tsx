'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { countByType, filterPile, type CardType } from '@/lib/game/card-types'
import { placeAt, shiftCard, syncOrder } from '@/lib/game/pile-order'
import type { Catalog, PlayerZone, Position, VisibleCard } from '@/lib/game/types'
import GameCard, { type Lang } from './GameCard'
import { touchTarget } from './touch'
import { useT } from '@/components/i18n/I18nProvider'

/** Destinations d'une carte ; `key` : son libellé (`t.table.pile.targets`). */
const TARGETS: { key: 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'top' | 'bottom'; to: PlayerZone; position?: Position }[] = [
  { key: 'hand', to: 'hand' },
  { key: 'battlefield', to: 'battlefield' },
  { key: 'graveyard', to: 'graveyard' },
  { key: 'exile', to: 'exile' },
  { key: 'top', to: 'library', position: 'top' },
  { key: 'bottom', to: 'library', position: 'bottom' },
]

/**
 * Fenêtre listant les cartes visibles d'une zone, avec un bouton par destination.
 * Une carte déplacée disparaît de la liste. Avec `onReorder` (regard), les cartes se réordonnent
 * par glisser-déposer ou avec les flèches ; la première est le dessus de la bibliothèque.
 */
export default function PileModal({ title, zone, cards, searchable, shuffleDefault, catalogs, lang, readOnly = false, onMove, onReorder, onClose }: {
  title: string
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
  onClose: (shuffle: boolean) => void
}) {
  const t = useT()
  const pl = t.table.pile
  const [moved, setMoved] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [types, setTypes] = useState<CardType[]>([])
  const [shuffle, setShuffle] = useState(shuffleDefault ?? false)

  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id))
  const [dragged, setDragged] = useState<string | null>(null)

  const present = cards.filter((card) => !moved.has(card.id))
  const ordered = onReorder ? syncOrder(order, present.map((c) => c.id)) : null
  const remaining = ordered ? ordered.map((id) => present.find((c) => c.id === id)!) : present
  const reorder = (next: string[]) => {
    setOrder(next)
    onReorder?.(next)
  }
  const visible = filterPile(remaining, { text: filter, types }, catalogs)
  // Types présents dans la pile, plus ceux encore cochés dont la dernière carte vient de partir.
  const counts = countByType(remaining, catalogs)
  const typeButtons = [...counts, ...types.filter((ty) => !counts.some((c) => c.type === ty)).map((ty) => ({ type: ty, count: 0 }))]
  const toggle = (ty: CardType) => setTypes((prev) => (prev.includes(ty) ? prev.filter((x) => x !== ty) : [...prev, ty]))
  const chip = (active: boolean) =>
    `text-xs px-2 py-1 rounded-full border ${active ? 'border-dc-gold bg-dc-gold/15 text-dc-gold' : 'border-dc-border text-dc-text hover:border-dc-gold/50'}`

  return (
    // Posée sur la table (sous la barre du site) ; la liste défile dans la fenêtre, l'en-tête et les filtres restent visibles.
    <div className="absolute inset-0 z-[55] bg-black/70 flex items-center justify-center p-3 sm:p-6" onClick={() => onClose(shuffle)}>
      <div className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-5xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-dc-border">
          <h2 className="font-fantasy text-dc-gold">{title}</h2>
          {searchable && (
            <input autoFocus className="flex-1 min-w-[10rem] bg-dc-bg border border-dc-border rounded-lg px-3 py-1.5 text-sm text-dc-text" placeholder={pl.filter} value={filter} onChange={(e) => setFilter(e.target.value)} />
          )}
          {shuffleDefault !== null && (
            <label className="flex items-center gap-1.5 text-xs text-dc-muted ml-auto">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> {pl.shuffleOnClose}
            </label>
          )}
          <button onClick={() => onClose(shuffle)} className="text-dc-muted hover:text-dc-text" aria-label={t.common.close}><X className="w-5 h-5" /></button>
        </div>
        {searchable && typeButtons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-dc-border" role="group" aria-label={pl.filterByType}>
            <button className={chip(types.length === 0)} aria-pressed={types.length === 0} onClick={() => setTypes([])}>{pl.allTypes}</button>
            {typeButtons.map((b) => (
              <button key={b.type} className={chip(types.includes(b.type))} aria-pressed={types.includes(b.type)} onClick={() => toggle(b.type)}>
                {pl.types[b.type]} ({b.count})
              </button>
            ))}
          </div>
        )}
        <div className="min-h-0 overflow-y-auto p-4 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4">
          {visible.length === 0 && <p className="text-dc-muted text-sm col-span-full">{pl.noCards}</p>}
          {visible.map((card, index) => (
            <div
              key={card.id}
              className={`space-y-1.5 ${dragged === card.id ? 'opacity-40' : ''}`}
              data-pile-card={card.id}
              draggable={!!ordered && !readOnly}
              onDragStart={() => setDragged(card.id)}
              onDragEnd={() => setDragged(null)}
              onDragOver={(e) => { if (dragged) e.preventDefault() }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragged && ordered) reorder(placeAt(ordered, dragged, card.id))
                setDragged(null)
              }}
            >
              <div className="relative">
                <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} />
                {ordered && index === 0 && (
                  <span className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 rounded bg-dc-gold text-black text-[10px] font-semibold" data-pile-top>{pl.top}</span>
                )}
              </div>
              {ordered && !readOnly && (
                <div className="flex justify-between">
                  <button className={`p-0.5 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-30 ${touchTarget}`} aria-label={pl.towardTop}
                    disabled={index === 0} onClick={() => reorder(shiftCard(ordered, card.id, -1))}><ChevronLeft className="w-4 h-4" /></button>
                  <button className={`p-0.5 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-30 ${touchTarget}`} aria-label={pl.towardBottom}
                    disabled={index === ordered.length - 1} onClick={() => reorder(shiftCard(ordered, card.id, 1))}><ChevronRight className="w-4 h-4" /></button>
                </div>
              )}
              {!readOnly && <div className="grid grid-cols-3 gap-1">
                {TARGETS.filter((d) => !(d.to === zone && d.to !== 'library')).map((d) => (
                  <button
                    key={d.key}
                    className="text-[10px] px-1 py-0.5 [@media(pointer:coarse)]:min-h-8 rounded border border-dc-border text-dc-text hover:border-dc-gold/50"
                    onClick={() => {
                      onMove(card, d.to, d.position)
                      setMoved((prev) => new Set(prev).add(card.id))
                    }}
                  >
                    {pl.targets[d.key]}
                  </button>
                ))}
              </div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
