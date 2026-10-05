'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { CARD_TYPES, countByType, filterPile, type CardType } from '@/lib/game/card-types'
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

const TYPE_LABEL = Object.fromEntries(CARD_TYPES.map((t) => [t.type, t.label])) as Record<CardType, string>

/**
 * Fenêtre listant les cartes visibles d'une zone, avec un bouton par destination.
 * Une carte déplacée disparaît de la liste.
 */
export default function PileModal({ title, zone, cards, searchable, shuffleDefault, catalogs, lang, readOnly = false, onMove, onClose }: {
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
  onClose: (shuffle: boolean) => void
}) {
  const [moved, setMoved] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [types, setTypes] = useState<CardType[]>([])
  const [shuffle, setShuffle] = useState(shuffleDefault ?? false)

  const remaining = cards.filter((card) => !moved.has(card.id))
  const visible = filterPile(remaining, { text: filter, types }, catalogs)
  // Types présents dans la pile, plus ceux encore cochés dont la dernière carte vient de partir.
  const counts = countByType(remaining, catalogs)
  const typeButtons = [...counts, ...types.filter((t) => !counts.some((c) => c.type === t)).map((t) => ({ type: t, label: TYPE_LABEL[t], count: 0 }))]
  const toggle = (t: CardType) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  const chip = (active: boolean) =>
    `text-xs px-2 py-1 rounded-full border ${active ? 'border-dc-gold bg-dc-gold/15 text-dc-gold' : 'border-dc-border text-dc-text hover:border-dc-gold/50'}`

  return (
    // Posée sur la table (sous la barre du site) ; la liste défile dans la fenêtre, l'en-tête et les filtres restent visibles.
    <div className="absolute inset-0 z-[55] bg-black/70 flex items-center justify-center p-3 sm:p-6" onClick={() => onClose(shuffle)}>
      <div className="bg-dc-surface border border-dc-border rounded-2xl w-full max-w-5xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-dc-border">
          <h2 className="font-fantasy text-dc-gold">{title}</h2>
          {searchable && (
            <input autoFocus className="flex-1 min-w-[10rem] bg-dc-bg border border-dc-border rounded-lg px-3 py-1.5 text-sm text-dc-text" placeholder="Filtrer par nom (FR ou EN)…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          )}
          {shuffleDefault !== null && (
            <label className="flex items-center gap-1.5 text-xs text-dc-muted ml-auto">
              <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> Mélanger en fermant
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
          {visible.map((card) => (
            <div key={card.id} className="space-y-1.5" data-pile-card={card.id}>
              <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} />
              {!readOnly && <div className="grid grid-cols-3 gap-1">
                {TARGETS.filter((t) => !(t.to === zone && t.to !== 'library')).map((t) => (
                  <button
                    key={t.label}
                    className="text-[10px] px-1 py-0.5 rounded border border-dc-border text-dc-text hover:border-dc-gold/50"
                    onClick={() => {
                      onMove(card, t.to, t.position)
                      setMoved((prev) => new Set(prev).add(card.id))
                    }}
                  >
                    {t.label}
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
