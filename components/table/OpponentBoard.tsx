'use client'

import type { MenuPoint } from './touch'
import PlayerColumn from './PlayerColumn'
import { Battlefield, OpponentHand, ZonePile, type ZoneProps } from './zones'

/**
 * Plateau réel d'un adversaire (Duel, ou vue agrandie). Ses zones acceptent le glisser-déposer.
 * - `column` (Duel) : sa colonne à gauche, alignée sur la mienne ; la bande de sa main au-dessus de son champ de bataille.
 * - `header` (3 à 5 joueurs, vue agrandie) : une ligne fine (pastille, main, piles en mini-vignettes) au-dessus.
 */
export default function OpponentBoard(props: ZoneProps & {
  me: string | null
  layout: 'column' | 'header'
  /** Pastille (`header`) ou ligne portrait (`column`). */
  panel: React.ReactNode
  onLibraryMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
}) {
  const { panel, onLibraryMenu, onPile, me, layout, ...zoneProps } = props
  const name = zoneProps.view.players[zoneProps.player].name
  if (layout === 'column') {
    return (
      <div className="h-full min-h-0 flex flex-col sm:flex-row gap-2" data-board={zoneProps.player}>
        <PlayerColumn {...zoneProps} me={me} portrait={panel} onLibraryMenu={onLibraryMenu}
          onPile={(zone, title) => onPile(zone, `${title} de ${name}`)} />
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-1.5">
          <OpponentHand {...zoneProps} />
          <Battlefield {...zoneProps} label={`Champ de bataille de ${name}`} />
        </div>
      </div>
    )
  }
  return (
    <div className="h-full min-h-0 flex flex-col gap-1.5" data-board={zoneProps.player}>
      <div className="h-12 shrink-0 flex items-center gap-2">
        <div className="shrink-0">{panel}</div>
        <OpponentHand {...zoneProps} />
        <div className="ml-auto h-full flex gap-1">
          <ZonePile zone="command" size="mini" me={me} {...zoneProps} />
          <ZonePile zone="library" size="mini" me={me} {...zoneProps} onPileContextMenu={onLibraryMenu} />
          <ZonePile zone="graveyard" size="mini" me={me} {...zoneProps} onPileClick={() => onPile('graveyard', `Cimetière de ${name}`)} />
          <ZonePile zone="exile" size="mini" me={me} {...zoneProps} onPileClick={() => onPile('exile', `Exil de ${name}`)} />
        </div>
      </div>
      <Battlefield {...zoneProps} label={`Champ de bataille de ${name}`} />
    </div>
  )
}
