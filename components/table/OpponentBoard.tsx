'use client'

import type { MenuPoint } from './touch'
import PlayerColumn from './PlayerColumn'
import PlayerHeader from './PlayerHeader'
import { Battlefield, OpponentHand, type ZoneProps } from './zones'

/**
 * Plateau réel d'un adversaire (Duel, ou vue agrandie). Ses zones acceptent le glisser-déposer.
 * - `column` (Duel) : sa colonne à gauche, alignée sur la mienne.
 * - `header` (3 à 5 joueurs, vue agrandie) : son en-tête au-dessus, comme dans son bandeau.
 * Dans les deux cas, la bande de sa main (cartes révélées comprises) est au-dessus de son champ de bataille.
 */
export default function OpponentBoard(props: ZoneProps & {
  me: string | null
  layout: 'column' | 'header'
  /** Ligne portrait (`PlayerPortrait`, taille `column` ou `header`). */
  portrait: React.ReactNode
  onLibraryMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
}) {
  const { portrait, onLibraryMenu, onPile, me, layout, ...zoneProps } = props
  const name = zoneProps.view.players[zoneProps.player].name
  const field = (
    <>
      <OpponentHand {...zoneProps} />
      <Battlefield {...zoneProps} label={`Champ de bataille de ${name}`} />
    </>
  )
  if (layout === 'column') {
    return (
      <div className="h-full min-h-0 flex flex-col sm:flex-row gap-2" data-board={zoneProps.player}>
        <PlayerColumn {...zoneProps} me={me} portrait={portrait} onLibraryMenu={onLibraryMenu}
          onPile={(zone, title) => onPile(zone, `${title} de ${name}`)} />
        <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-1.5">{field}</div>
      </div>
    )
  }
  return (
    <div className="h-full min-h-0 flex flex-col gap-1.5" data-board={zoneProps.player}>
      <PlayerHeader {...zoneProps} me={me} wide portrait={portrait} onLibraryMenu={onLibraryMenu} onPile={onPile} />
      {field}
    </div>
  )
}
