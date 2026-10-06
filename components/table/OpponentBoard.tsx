'use client'

import type { MenuPoint } from './touch'
import PlayerColumn from './PlayerColumn'
import { Battlefield, OpponentHand, type ZoneProps } from './zones'

/**
 * Plateau réel d'un adversaire (Duel, ou vue agrandie à 3 à 5 joueurs) : sa colonne à gauche, comme la mienne,
 * puis la bande de sa main (cartes révélées comprises) et son champ de bataille. Ses zones acceptent le glisser-déposer.
 */
export default function OpponentBoard(props: ZoneProps & {
  me: string | null
  /** Ligne portrait (`PlayerPortrait size="column"`). */
  portrait: React.ReactNode
  onLibraryMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
}) {
  const { portrait, onLibraryMenu, onPile, me, ...zoneProps } = props
  const name = zoneProps.view.players[zoneProps.player].name
  return (
    <div className="h-full min-h-0 flex flex-col sm:flex-row gap-2" data-board={zoneProps.player}>
      <PlayerColumn {...zoneProps} me={me} portrait={portrait} onLibraryMenu={onLibraryMenu}
        onPile={(zone, title) => onPile(zone, `${title} de ${name}`)} />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-1.5">
        <OpponentHand {...zoneProps} />
        <Battlefield {...zoneProps} label={`Champ de bataille de ${name}`} />
      </div>
    </div>
  )
}
