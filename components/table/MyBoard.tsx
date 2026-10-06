'use client'

import type { MenuPoint } from './touch'
import { Battlefield, Hand, ZonePile, type ZoneProps } from './zones'

/** Mon plateau : champ de bataille, colonne de piles, main. */
export default function MyBoard(props: Omit<ZoneProps, 'player'> & {
  player: string
  me: string
  /** Mes compteurs (en ligne ; en mode test, la vie est dans la barre du haut). */
  panel?: React.ReactNode
  onLibraryMenu: (at: MenuPoint) => void
  onHandMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
}) {
  const { onLibraryMenu, onHandMenu, onPile, me, panel, ...zoneProps } = props
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 p-2" data-board={zoneProps.player}>
      <div className="flex-1 min-h-0 flex gap-2">
        <Battlefield {...zoneProps} />
        <div className="w-36 shrink-0 grid grid-rows-4 gap-2 min-h-0">
          <ZonePile zone="command" me={me} {...zoneProps} />
          <ZonePile zone="library" me={me} {...zoneProps} onPileContextMenu={onLibraryMenu} />
          <ZonePile zone="graveyard" me={me} {...zoneProps} onPileClick={() => onPile('graveyard', 'Cimetière')} />
          <ZonePile zone="exile" me={me} {...zoneProps} onPileClick={() => onPile('exile', 'Exil')} />
        </div>
      </div>
      <div className="h-[28%] shrink-0 flex gap-2 items-center">
        {panel && <div className="shrink-0">{panel}</div>}
        <Hand {...zoneProps} onZoneContextMenu={onHandMenu} />
      </div>
    </div>
  )
}
