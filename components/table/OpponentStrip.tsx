'use client'

import { cardInfo } from '@/lib/game/apply'
import { groupBattlefield, type Stack } from '@/lib/game/battlefield'
import type { Catalog, PlayerView, VisibleCard } from '@/lib/game/types'
import GameCard, { CardBack, type Lang } from './GameCard'
import { longPressClass, menuGesture } from './touch'
import { ptEdit, type CardHandlers } from './zones'

const ROWS = [['creatures', 'Créatures'], ['others', 'Autres'], ['lands', 'Terrains']] as const

/**
 * Bandeau d'un adversaire (vue « Tous ») : sa colonne compacte à gauche (ligne portrait, cases chiffrées,
 * commandement, dernière carte au cimetière), puis son champ de bataille trié en trois rangées sur toute la hauteur.
 */
export default function OpponentStrip({ view, player, catalogs, lang, handlers, highlighted, header, stacked = false }: {
  view: PlayerView
  player: string
  catalogs: Record<string, Catalog>
  lang: Lang
  handlers: CardHandlers
  highlighted?: Set<string>
  /** Colonne compacte (`PlayerHeader`), construite par la table. */
  header: React.ReactNode
  /** Bandeau étroit (3 adversaires ou plus) : les trois rangées l'une sous l'autre plutôt que côte à côte. */
  stacked?: boolean
}) {
  const zones = view.players[player].zones
  const rows = groupBattlefield(zones.battlefield, catalogs)
  const battlefield = { player, zone: 'battlefield' as const }
  const active = view.activePlayer === player
  // Cartes plus grandes qu'avant (40 px) : 80 px quand le bandeau est large (2 adversaires), 56 px sinon.
  const cardHeight = stacked ? 'h-14' : 'h-20'

  const mini = (card: VisibleCard, count = 1) => (
    <div
      key={card.id}
      data-strip-card={card.id}
      className={`relative ${cardHeight} shrink-0 ${longPressClass} ${highlighted?.has(card.id) ? 'ring-2 ring-dc-gold rounded-[6%]' : ''}`}
      style={{ transform: card.tapped ? 'rotate(90deg)' : undefined, margin: card.tapped ? (stacked ? '0 8px' : '0 12px') : undefined }}
      title={cardInfo(catalogs[card.owner], card, lang).name}
      onDoubleClick={() => handlers.onDoubleClick(card.id, battlefield)}
      {...menuGesture((at) => handlers.onContextMenu(card.id, battlefield, at))}
      onMouseEnter={() => handlers.onHover(card.id)}
      onMouseLeave={() => handlers.onHover(null)}
    >
      <GameCard card={card} catalog={catalogs[card.owner]} lang={lang} className="h-full" pt onPtEdit={ptEdit(handlers, card.id, battlefield)} />
      {count > 1 && <span className="absolute -bottom-1 -right-1 rounded-full bg-black/80 text-dc-gold text-[10px] px-1">×{count}</span>}
    </div>
  )

  // Pas d'overflow-hidden ici : la bulle de la ligne portrait déborde sous le bandeau.
  return (
    <div className={`h-full min-h-0 flex gap-2 rounded-xl border bg-dc-surface/30 p-1.5 ${active ? 'border-dc-gold/70' : 'border-dc-border'}`} data-strip={player}>
      {header}
      <div className={`flex-1 min-w-0 min-h-0 gap-2 overflow-y-auto ${stacked ? 'flex flex-col' : 'grid grid-cols-[2fr_1fr_1fr]'}`} data-zone="battlefield" data-player={player}>
        {ROWS.map(([key, label]) => (
          <div key={key} className="min-w-0 flex flex-col gap-0.5" data-row={key}>
            <span className="text-[10px] text-dc-muted">{label}</span>
            <div className="flex flex-wrap content-start items-center gap-1.5">
              {rows[key].map((stack: Stack) => mini(stack.cards[0], stack.count))}
              {key === 'others' && rows.hidden > 0 && Array.from({ length: rows.hidden }, (_, i) => <CardBack key={`x${i}`} className={cardHeight} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
