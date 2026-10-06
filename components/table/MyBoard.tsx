'use client'

import type { MenuPoint } from './touch'
import { Battlefield, Hand, ZonePile, type ZoneProps } from './zones'

/** Mon plateau : champ de bataille, puis ma ligne du bas (pastille, main, piles en vignettes). */
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
      <Battlefield {...zoneProps} />
      {/* Téléphone (sous 640 px) : les piles passent sur une ligne fine au-dessus de la main, qui garde sa largeur. */}
      <div className="h-[38%] sm:h-[25%] min-h-[96px] shrink-0 flex flex-col sm:flex-row gap-2 items-stretch">
        {panel && <div className="shrink-0 self-start sm:self-center">{panel}</div>}
        <Hand {...zoneProps} onZoneContextMenu={onHandMenu} />
        <div className="h-12 sm:h-auto shrink-0 flex justify-end gap-1.5 sm:py-1 max-sm:order-first">
          <ZonePile zone="command" size="tile" me={me} {...zoneProps} />
          <ZonePile zone="library" size="tile" me={me} {...zoneProps} onPileContextMenu={onLibraryMenu} />
          <ZonePile zone="graveyard" size="tile" me={me} {...zoneProps} onPileClick={() => onPile('graveyard', 'Cimetière')} />
          <ZonePile zone="exile" size="tile" me={me} {...zoneProps} onPileClick={() => onPile('exile', 'Exil')} />
        </div>
      </div>
    </div>
  )
}
