'use client'

import { cardInfo } from '@/lib/game/apply'
import { groupBattlefield, type Stack } from '@/lib/game/battlefield'
import type { Catalog, PlayerView, VisibleCard } from '@/lib/game/types'
import GameCard, { CardBack, type Lang } from './GameCard'
import { libraryTop, type CardHandlers } from './zones'

const ROWS = [['creatures', 'Créatures'], ['others', 'Autres'], ['lands', 'Terrains']] as const

/** Bandeau compact d'un adversaire : compteurs, main et bibliothèque en nombre, piles, champ de bataille trié en trois colonnes. */
export default function OpponentStrip({ view, player, catalogs, lang, handlers, highlighted, panel, onPile, onLibraryMenu }: {
  view: PlayerView
  player: string
  catalogs: Record<string, Catalog>
  lang: Lang
  handlers: CardHandlers
  highlighted?: Set<string>
  panel: React.ReactNode
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
  onLibraryMenu: (e: React.MouseEvent) => void
}) {
  const zones = view.players[player].zones
  const rows = groupBattlefield(zones.battlefield, catalogs)
  const visible = (cards: typeof zones.graveyard) => cards.filter((c): c is VisibleCard => !c.hidden)
  const battlefield = { player, zone: 'battlefield' as const }
  const top = libraryTop(view, player)

  const mini = (card: VisibleCard, zone: 'battlefield' | 'command' | 'graveyard' | 'exile', count = 1) => (
    <div
      key={card.id}
      data-strip-card={card.id}
      className={`relative h-10 shrink-0 ${highlighted?.has(card.id) ? 'ring-2 ring-dc-gold rounded-[6%]' : ''}`}
      style={{ transform: card.tapped ? 'rotate(90deg)' : undefined, margin: card.tapped ? '0 7px' : undefined }}
      title={cardInfo(catalogs[card.owner], card, lang).name}
      onDoubleClick={() => zone === 'battlefield' && handlers.onDoubleClick(card.id, battlefield)}
      onContextMenu={(e) => {
        e.preventDefault()
        handlers.onContextMenu(card.id, { player, zone }, e)
      }}
      onMouseEnter={() => handlers.onHover(card.id)}
      onMouseLeave={() => handlers.onHover(null)}
    >
      <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} className="h-full" />
      {count > 1 && <span className="absolute -bottom-1 -right-1 rounded-full bg-black/80 text-dc-gold text-[10px] px-1">×{count}</span>}
    </div>
  )

  const pile = (zone: 'graveyard' | 'exile', title: string) => {
    const cards = visible(zones[zone])
    const top = cards.at(-1)
    return (
      <button className="flex items-center gap-1 text-[11px] text-dc-muted hover:text-dc-text" data-zone={zone} data-player={player} onClick={() => onPile(zone, title)}>
        {top ? <div className="h-6"><GameCard card={top} catalog={catalogs[top.owner]} lang={lang} className="h-full" /></div> : <div className="h-6 aspect-[63/88] rounded border border-dashed border-dc-border" />}
        {title} ({zones[zone].length})
      </button>
    )
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-1 overflow-hidden rounded-xl border border-dc-border bg-dc-surface/30 p-1.5" data-strip={player}>
      {panel}
      <div className="flex-1 min-h-0 flex gap-2">
        <div className="w-28 shrink-0 flex flex-col gap-0.5 overflow-hidden text-[11px] text-dc-muted">
          <span data-zone="hand" data-player={player}>Main : <span className="text-dc-text" data-testid="hand-count">{zones.hand.length}</span></span>
          <span data-zone="library" data-player={player} className="flex items-center gap-1 cursor-context-menu" onContextMenu={(e) => { e.preventDefault(); onLibraryMenu(e) }}>
            {top && (
              <span className="h-6 shrink-0" onMouseEnter={() => handlers.onHover(top.id)} onMouseLeave={() => handlers.onHover(null)}>
                <GameCard card={top} catalog={catalogs[top.owner]} lang={lang} className="h-full" />
              </span>
            )}
            <span>Bibliothèque : <span className="text-dc-text">{zones.library.count}</span></span>
          </span>

          {visible(zones.command).length > 0 && (
            <div className="flex items-center gap-1" data-zone="command" data-player={player}>
              {visible(zones.command).map((c) => (
                <div key={c.id} className="h-6" title={cardInfo(catalogs[c.owner], c, lang).name}
                  onContextMenu={(e) => { e.preventDefault(); handlers.onContextMenu(c.id, { player, zone: 'command' }, e) }}
                  onMouseEnter={() => handlers.onHover(c.id)} onMouseLeave={() => handlers.onHover(null)}>
                  <GameCard card={c} catalog={catalogs[c.owner]} lang={lang} className="h-full" />
                </div>
              ))}
              Commandement
            </div>
          )}
          {pile('graveyard', 'Cimetière')}
          {pile('exile', 'Exil')}
        </div>
        <div className="flex-1 min-w-0 grid grid-cols-[2fr_1fr_1fr] gap-2 overflow-y-auto" data-zone="battlefield" data-player={player}>
          {ROWS.map(([key, label]) => (
            <div key={key} className="min-w-0 flex flex-col gap-0.5" data-row={key}>
              <span className="text-[10px] text-dc-muted">{label}</span>
              <div className="flex flex-wrap content-start items-center gap-1.5">
                {rows[key].map((stack: Stack) => mini(stack.cards[0], 'battlefield', stack.count))}
                {key === 'others' && rows.hidden > 0 && Array.from({ length: rows.hidden }, (_, i) => <CardBack key={`x${i}`} className="h-10" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
