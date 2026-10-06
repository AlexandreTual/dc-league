'use client'

import type { MenuPoint } from './touch'
import { Battlefield, OpponentHand, ZonePile, type ZoneProps } from './zones'

/**
 * Plateau réel d'un adversaire (vue agrandie) : une ligne fine (pastille, main, piles en mini-vignettes)
 * au-dessus de son champ de bataille. Ses zones acceptent le glisser-déposer.
 */
export default function OpponentBoard(props: ZoneProps & {
  me: string | null
  panel: React.ReactNode
  onLibraryMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
}) {
  const { panel, onLibraryMenu, onPile, me, ...zoneProps } = props
  const name = zoneProps.view.players[zoneProps.player].name
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
