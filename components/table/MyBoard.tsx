'use client'

import type { MenuPoint } from './touch'
import PlayerColumn from './PlayerColumn'
import { Battlefield, Hand, type ZoneProps } from './zones'

/** Mon plateau : ma colonne à gauche, puis mon champ de bataille et ma main sur toute la largeur restante. */
export default function MyBoard(props: Omit<ZoneProps, 'player'> & {
  player: string
  me: string
  /** Ma ligne portrait (vie, compteurs). */
  portrait: React.ReactNode
  onLibraryMenu: (at: MenuPoint) => void
  onHandMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
}) {
  const { onLibraryMenu, onHandMenu, onPile, me, portrait, ...zoneProps } = props
  return (
    <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-2 p-2" data-board={zoneProps.player}>
      <PlayerColumn {...zoneProps} me={me} portrait={portrait} onLibraryMenu={onLibraryMenu} onPile={onPile} />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
        <Battlefield {...zoneProps} />
        <div className="h-[38%] sm:h-[25%] min-h-[96px] shrink-0 flex">
          <Hand {...zoneProps} onZoneContextMenu={onHandMenu} />
        </div>
      </div>
    </div>
  )
}
