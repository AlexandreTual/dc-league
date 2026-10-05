'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { cardInfo } from '@/lib/game/apply'
import type { Catalog, PlayerZone, Position, VisibleCard } from '@/lib/game/types'
import GameCard, { type Lang } from './GameCard'

const TARGETS: { label: string; to: PlayerZone; position?: Position }[] = [
  { label: 'Main', to: 'hand' },
  { label: 'Champ', to: 'battlefield' },
  { label: 'Cimetière', to: 'graveyard' },
  { label: 'Exil', to: 'exile' },
  { label: 'Dessus', to: 'library', position: 'top' },
  { label: 'Dessous', to: 'library', position: 'bottom' },
]

/**
 * Fenêtre listant les cartes visibles d'une zone, avec un bouton par destination.
 * Une carte déplacée disparaît de la liste.
 */
export default function PileModal({ title, zone, cards, searchable, shuffleDefault, catalog, lang, onMove, onClose }: {
  title: string
  zone: PlayerZone
  cards: VisibleCard[]
  searchable: boolean
  shuffleDefault: boolean | null
  catalog: Catalog
  lang: Lang
  onMove: (id: string, to: PlayerZone, position?: Position) => void
  onClose: (shuffle: boolean) => void
}) {
  const [moved, setMoved] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [shuffle, setShuffle] = useState(shuffleDefault ?? false)

  const visible = cards.filter((card) => !moved.has(card.id)).filter((card) => {
    if (!filter.trim()) return true
    const q = filter.trim().toLowerCase()
    return [cardInfo(catalog, card, 'fr').name, cardInfo(catalog, card, 'en').name].some((n) => n.toLowerCase().includes(q))
  })

  return (
    <div className="fixed inset-0 z-[55] bg-black/70 flex items-center justify-center p-6" onClick={() => onClose(shuffle)}>
      <div className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-5xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-dc-border">
          <h2 className="font-fantasy text-dc-gold">{title}</h2>
          {searchable && (
            <input autoFocus className="flex-1 bg-dc-bg border border-dc-border rounded-lg px-3 py-1.5 text-sm text-dc-text" placeholder="Filtrer par nom (FR ou EN)…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          )}
          {shuffleDefault !== null && (
            <label className="flex items-center gap-1.5 text-xs text-dc-muted ml-auto">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> Mélanger en fermant
            </label>
          )}
          <button onClick={() => onClose(shuffle)} className="text-dc-muted hover:text-dc-text" aria-label="Fermer"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto p-4 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-4">
          {visible.length === 0 && <p className="text-dc-muted text-sm col-span-full">Aucune carte.</p>}
          {visible.map(({ id, ...card }) => (
            <div key={id} className="space-y-1.5" data-pile-card={id}>
              <GameCard card={{ id, ...card }} catalog={catalog} lang={lang} />
              <div className="grid grid-cols-3 gap-1">
                {TARGETS.filter((t) => !(t.to === zone && t.to !== 'library')).map((t) => (
                  <button
                    key={t.label}
                    className="text-[10px] px-1 py-0.5 rounded border border-dc-border text-dc-text hover:border-dc-gold/50"
                    onClick={() => {
                      onMove(id, t.to, t.position)
                      setMoved((prev) => new Set(prev).add(id))
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
