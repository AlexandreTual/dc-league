'use client'

import type { MenuPoint } from './touch'
import { CommandBlock, GraveyardLast, PileCases } from './PileCases'
import type { ZoneProps } from './zones'

/**
 * En-tête d'un adversaire (bandeau « Tous » et vue agrandie, 3 à 5 joueurs) : ligne portrait compacte,
 * cases chiffrées et vignette de commandement, puis la dernière carte arrivée au cimetière.
 */
export default function PlayerHeader(props: ZoneProps & {
  me: string | null
  /** Ligne portrait (`PlayerPortrait size="header"`), construite par la table. */
  portrait: React.ReactNode
  /** Bandeau : la case Main porte `data-zone="hand"` (pas d'autre main affichée). */
  handZone?: boolean
  /** Vue agrandie : tout sur une ligne, pour laisser la hauteur au champ de bataille. */
  wide?: boolean
  onLibraryMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
}) {
  const { portrait, handZone, wide, onPile, onLibraryMenu, ...zoneProps } = props
  const name = zoneProps.view.players[zoneProps.player].name
  const titles = { graveyard: `Cimetière de ${name}`, exile: `Exil de ${name}` }
  return (
    <div className={`shrink-0 flex gap-1 ${wide ? 'flex-row flex-wrap items-center' : 'flex-col'}`} data-header={zoneProps.player}>
      <div className={wide ? 'w-72 shrink-0' : ''}>{portrait}</div>
      <div className={`flex items-stretch gap-1 ${wide ? 'w-72 shrink-0' : ''}`}>
        <div className="flex-1 min-w-0">
          <PileCases {...zoneProps} handZone={handZone} onLibraryMenu={onLibraryMenu} onPile={(zone) => onPile(zone, titles[zone])} />
        </div>
        <CommandBlock {...zoneProps} mini />
      </div>
      <GraveyardLast {...zoneProps} onOpen={() => onPile('graveyard', titles.graveyard)} />
    </div>
  )
}
