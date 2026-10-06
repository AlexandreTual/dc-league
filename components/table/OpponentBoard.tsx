'use client'

import { Battlefield, OpponentHand, ZonePile, type ZoneProps } from './zones'

/** Plateau réel d'un adversaire (vue agrandie) : ses zones acceptent le glisser-déposer. */
export default function OpponentBoard(props: ZoneProps & {
  me: string | null
  panel: React.ReactNode
  onLibraryMenu: (e: React.MouseEvent) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
}) {
  const { panel, onLibraryMenu, onPile, me, ...zoneProps } = props
  const name = zoneProps.view.players[zoneProps.player].name
  return (
    <div className="h-full min-h-0 flex flex-col gap-1.5" data-board={zoneProps.player}>
      <div className="shrink-0 flex items-center">{panel}</div>
      <div className="flex-1 min-h-0 flex gap-2">
        <Battlefield {...zoneProps} label={`Champ de bataille de ${name}`} />
        <div className="w-44 shrink-0 grid grid-cols-2 grid-rows-2 gap-1.5 min-h-0">
          <ZonePile zone="command" me={me} compact {...zoneProps} />
          <ZonePile zone="library" me={me} compact {...zoneProps} onPileContextMenu={onLibraryMenu} />
          <ZonePile zone="graveyard" me={me} compact {...zoneProps} onPileClick={() => onPile('graveyard', `Cimetière de ${name}`)} />
          <ZonePile zone="exile" me={me} compact {...zoneProps} onPileClick={() => onPile('exile', `Exil de ${name}`)} />
        </div>
      </div>
      <OpponentHand {...zoneProps} />
    </div>
  )
}
