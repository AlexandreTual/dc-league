'use client'

import type { MenuPoint } from './touch'
import { CommandBlock, GraveyardLast, PileCases } from './PileCases'
import type { ZoneProps } from './zones'

/**
 * Colonne compacte d'un adversaire, à gauche de son bandeau (vue « Tous », 3 à 5 joueurs) : ligne portrait,
 * cases chiffrées sur deux rangées, vignette de commandement et dernière carte arrivée au cimetière.
 * Les rangées de son champ de bataille gardent ainsi toute la hauteur du bandeau.
 */
export default function PlayerHeader(props: ZoneProps & {
  me: string | null
  /** Ligne portrait (`PlayerPortrait size="header"`), construite par la table. */
  portrait: React.ReactNode
  /** La case Main porte `data-zone="hand"` (le bandeau n'affiche pas d'autre main). */
  handZone?: boolean
  onLibraryMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
}) {
  const { portrait, handZone, onPile, onLibraryMenu, ...zoneProps } = props
  const name = zoneProps.view.players[zoneProps.player].name
  const titles = { graveyard: `Cimetière de ${name}`, exile: `Exil de ${name}` }
  return (
    <div className="w-[184px] shrink-0 min-h-0 flex flex-col gap-1" data-header={zoneProps.player}>
      {portrait}
      <PileCases {...zoneProps} cols={2} handZone={handZone} onLibraryMenu={onLibraryMenu} onPile={(zone) => onPile(zone, titles[zone])} />
      {/* Bandeau trop bas (tablette, barre du haut sur deux lignes) : cette ligne se replie plutôt que de déborder ; p-0.5 -m-0.5 garde visible le cadre doré de dépôt. */}
      <div className="flex items-center gap-1 min-w-0 min-h-0 overflow-hidden p-0.5 -m-0.5">
        <CommandBlock {...zoneProps} mini />
        <div className="flex-1 min-w-0">
          <GraveyardLast {...zoneProps} onOpen={() => onPile('graveyard', titles.graveyard)} />
        </div>
      </div>
    </div>
  )
}
