'use client'

import { Battlefield, Hand, ZonePile, type ZoneProps } from './zones'

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
      {panel}
      <div className="flex-1 min-h-0 flex gap-2">
        <Battlefield {...zoneProps} label={`Champ de bataille de ${name}`} />
        <div className="w-28 shrink-0 grid grid-rows-4 gap-1.5 min-h-0">
          <ZonePile zone="command" me={me} {...zoneProps} />
          <ZonePile zone="library" me={me} {...zoneProps} onPileContextMenu={onLibraryMenu} />
          <ZonePile zone="graveyard" me={me} {...zoneProps} onPileClick={() => onPile('graveyard', `Cimetière de ${name}`)} />
          <ZonePile zone="exile" me={me} {...zoneProps} onPileClick={() => onPile('exile', `Exil de ${name}`)} />
        </div>
      </div>
      <Hand {...zoneProps} heightClass="h-[22%]" />
    </div>
  )
}
