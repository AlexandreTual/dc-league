'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Shuffle, X } from 'lucide-react'
import { placeAt, shiftCard } from '@/lib/game/pile-order'
import type { Catalog, VisibleCard } from '@/lib/game/types'
import GameCard, { type Lang } from './GameCard'
import { touchTarget } from './touch'
import { useT } from '@/components/i18n/I18nProvider'

/**
 * Ordre de cartes sélectionnées avant de les poser sur une pile (bibliothèque, cimetière) : la première finit
 * au-dessus des autres. Réordonnées par glisser-déposer ou avec les flèches, ou posées dans un ordre aléatoire.
 */
export default function OrderModal({ title, cards, catalogs, lang, onConfirm, onRandom, onClose }: {
  title: string
  cards: VisibleCard[]
  catalogs: Record<string, Catalog>
  lang: Lang
  onConfirm: (ids: string[]) => void
  onRandom: () => void
  onClose: () => void
}) {
  const t = useT()
  const pl = t.table.pile
  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id))
  const [dragged, setDragged] = useState<string | null>(null)
  // Une carte partie entre-temps (jouée par un autre geste) disparaît de la liste.
  const ordered = order.flatMap((id) => cards.filter((c) => c.id === id))
  const ids = ordered.map((c) => c.id)
  const button = 'px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1.5'

  return (
    <div className="absolute inset-0 z-[55] bg-black/70 flex items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-5xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label={title} data-testid="order-modal">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-dc-border">
          <h2 className="font-fantasy text-dc-gold">{title}</h2>
          <p className="text-xs text-dc-muted">{pl.orderHelp}</p>
          <button onClick={onClose} className="ml-auto text-dc-muted hover:text-dc-text" aria-label={t.common.close}><X className="w-5 h-5" /></button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4">
          {ordered.map((card, index) => (
            <div
              key={card.id}
              className={`space-y-1.5 ${dragged === card.id ? 'opacity-40' : ''}`}
              data-order-card={card.id}
              draggable
              onDragStart={() => setDragged(card.id)}
              onDragEnd={() => setDragged(null)}
              onDragOver={(e) => { if (dragged) e.preventDefault() }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragged) setOrder(placeAt(ids, dragged, card.id))
                setDragged(null)
              }}
            >
              <div className="relative">
                <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} />
                {index === 0 && (
                  <span className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 rounded bg-dc-gold text-black text-[10px] font-semibold">{pl.top}</span>
                )}
              </div>
              <div className="flex justify-between">
                <button className={`p-0.5 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-30 ${touchTarget}`} aria-label={pl.towardTop}
                  disabled={index === 0} onClick={() => setOrder(shiftCard(ids, card.id, -1))}><ChevronLeft className="w-4 h-4" /></button>
                <button className={`p-0.5 rounded border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-30 ${touchTarget}`} aria-label={pl.towardBottom}
                  disabled={index === ordered.length - 1} onClick={() => setOrder(shiftCard(ids, card.id, 1))}><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-4 py-3 border-t border-dc-border">
          <button className={`${button} border-dc-border text-dc-text hover:border-dc-gold/50`} onClick={onRandom}>
            <Shuffle className="w-4 h-4" /> {pl.random}
          </button>
          <button className={`${button} border-dc-gold/40 bg-dc-gold/20 text-dc-gold`} onClick={() => onConfirm(ids)} disabled={ids.length === 0}>
            {pl.confirmOrder}
          </button>
        </div>
      </div>
    </div>
  )
}
