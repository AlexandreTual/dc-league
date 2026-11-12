'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Minus } from 'lucide-react'
import type { ClientAction } from '@/lib/game/room'
import { MANA_COLORS, type ManaColor, type ManaPool as Pool } from '@/lib/game/types'
import { boardColors, clickDelta, detailPosition, manaTotal } from './manaPool'
import { longPressClass, menuGesture } from './touch'
import { useT } from '@/components/i18n/I18nProvider'

/** Pastille de chaque couleur ; son nom est dans le dictionnaire (`t.table.mana.colors`). */
const COLORS: Record<ManaColor, { className: string }> = {
  W: { className: 'bg-[#f3ead0] text-black' },
  U: { className: 'bg-[#2f7fd8] text-white' },
  B: { className: 'bg-[#3a3340] text-white border border-white/30' },
  R: { className: 'bg-[#d8432f] text-white' },
  G: { className: 'bg-[#2f9e4f] text-white' },
  C: { className: 'bg-[#a8a29e] text-black' },
}

function ManaSymbol({ color, small = false }: { color: ManaColor; small?: boolean }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-full font-bold shrink-0 ${small ? 'w-4 h-4 text-[9px]' : 'w-5 h-5 text-[10px]'} ${COLORS[color].className}`}>
      {color}
    </span>
  )
}

/**
 * Réserve de mana d'un joueur, en bas à gauche de son champ de bataille (façon Moxfield), visible de tous.
 * Ma réserve : les 6 symboles, même à 0 ; clic +1, Maj+clic +5, clic droit −1 ; au doigt, toucher +1 et appui long
 * pour le détail (−, Vider, garde au changement de tour), ouvert aussi par le bouton du total.
 * Celle d'un autre : lecture seule, couleurs non nulles. Seuls les symboles captent les événements (dépôt et glisser libres autour).
 */
export default function ManaPool({ pool, keep = false, editable, send }: {
  /** Absente quand le serveur de jeu n'a pas encore la réserve de mana (déployé avant elle) : rien n'est affiché. */
  pool: Pool | undefined
  keep: boolean | undefined
  editable: boolean
  send: (action: ClientAction) => void
}) {
  const m = useT().table.mana
  const [detail, setDetail] = useState<{ left: number; bottom: number; root: Element } | null>(null)
  const anchor = useRef<HTMLDivElement>(null)
  /** Type du dernier pointeur posé : le clic droit de la souris retire 1, l'appui long au doigt ouvre le détail. */
  const pointer = useRef('mouse')
  useEffect(() => {
    if (!detail) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDetail(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detail])

  const colors = boardColors(pool, editable)
  if (!pool || colors.length === 0) return null
  const total = manaTotal(pool)
  const add = (color: ManaColor, delta: number) => send({ type: 'mana', color, delta })
  const openDetail = () => {
    const el = anchor.current
    if (!el) return
    // Détail rendu dans la table (plein écran, au-dessus du site) : le champ de bataille le couperait (overflow-hidden).
    const root = el.closest('[data-table-root]') ?? document.body
    setDetail({ ...detailPosition(el.getBoundingClientRect(), { width: window.innerWidth, height: window.innerHeight }), root })
  }
  const press = menuGesture(openDetail)

  return (
    <div
      ref={anchor}
      className="inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-1.5 py-1 text-xs text-dc-text pointer-events-auto"
      data-testid="mana-pool"
    >
      {colors.map((c) => {
        const symbol = (
          <>
            <ManaSymbol color={c} small={!editable} />
            <span className={`min-w-[0.75rem] text-center tabular-nums ${pool[c] === 0 ? 'text-dc-muted' : 'font-semibold'}`}>{pool[c]}</span>
          </>
        )
        return editable ? (
          <button
            key={c}
            className={`inline-flex items-center justify-center gap-0.5 rounded-full hover:ring-2 hover:ring-dc-gold/60 tablet:min-h-11 tablet:min-w-11 ${longPressClass}`}
            data-mana={c} data-count={pool[c]}
            title={m.editTitle(m.colors[c], pool[c])}
            aria-label={m.plus(m.colors[c])}
            onPointerDown={(e) => { pointer.current = e.pointerType; press.onPointerDown?.(e) }}
            onClick={(e) => add(c, clickDelta(e))}
            onContextMenu={(e) => {
              if (pointer.current !== 'mouse') return press.onContextMenu?.(e)
              e.preventDefault()
              if (pool[c] > 0) add(c, -1)
            }}
          >
            {symbol}
          </button>
        ) : (
          <span key={c} className="inline-flex items-center gap-0.5" data-mana={c} data-count={pool[c]} title={m.count(m.colors[c], pool[c])}>{symbol}</span>
        )
      })}
      {keep && <span className="text-dc-muted" title={m.kept}>⟳</span>}
      {editable && (
        <button
          className="ml-0.5 rounded px-1 text-dc-muted hover:bg-dc-border hover:text-dc-text tablet:min-h-11"
          onClick={() => (detail ? setDetail(null) : openDetail())}
          aria-label={m.pool} aria-expanded={!!detail} title={m.detail}
          data-testid="mana-total"
        >
          Σ {total}
        </button>
      )}
      {detail && editable && createPortal(
        <>
          <div className="fixed inset-0 z-[57]" onClick={() => setDetail(null)} />
          <div
            className="fixed z-[58] w-60 rounded-xl border border-dc-border bg-dc-surface p-3 space-y-2 shadow-card text-xs text-dc-text"
            style={{ left: detail.left, bottom: detail.bottom }}
            role="dialog" aria-label={m.pool}
          >
            <div className="grid grid-cols-3 gap-1.5">
              {MANA_COLORS.map((c) => (
                <div key={c} className="flex items-center gap-1" data-mana-color={c}>
                  <button
                    className="rounded-full hover:ring-2 hover:ring-dc-gold/60"
                    onClick={(e) => add(c, clickDelta(e))}
                    onContextMenu={(e) => { e.preventDefault(); if (pool[c] > 0) add(c, -1) }}
                    aria-label={m.plusDetail(m.colors[c])}
                    title={m.detailTitle(m.colors[c])}
                  >
                    <ManaSymbol color={c} />
                  </button>
                  <span className="min-w-[1.25rem] text-center">{pool[c]}</span>
                  <button className="p-0.5 rounded hover:bg-dc-border disabled:opacity-30 tablet:p-1.5" disabled={pool[c] === 0} onClick={() => add(c, -1)} aria-label={m.minus(m.colors[c])}>
                    <Minus className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span>{m.total} <span className="font-semibold">{total}</span></span>
              <button className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded border border-dc-border hover:border-dc-gold/50 disabled:opacity-40" disabled={total === 0} onClick={() => send({ type: 'clearMana' })}>
                {m.clear}
              </button>
            </div>
            <label className="flex items-center gap-1.5 text-dc-muted">
              <input type="checkbox" checked={keep} onChange={() => send({ type: 'toggleKeepMana' })} />
              {m.keep}
            </label>
          </div>
        </>,
        detail.root,
      )}
    </div>
  )
}
