'use client'

import type { MenuPoint } from './touch'
import { PileTiles } from './PileCases'
import PlayerColumn from './PlayerColumn'
import { Battlefield, Hand, type ZoneProps } from './zones'

/**
 * Mon plateau : ma colonne à gauche, puis mon champ de bataille et ma main sur toute la largeur restante.
 * Par défaut, bibliothèque, cimetière, exil et commandement en vignettes à droite de la main (au-dessus sous 640 px),
 * et la colonne ne garde que la ligne portrait ; sur téléphone en vertical, bibliothèque et bouton des piles côte à côte
 * au-dessus de la main, le champ de bataille prenant toute la hauteur restante ; réglage « Piles dans la colonne » : l'ancienne disposition.
 */
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
  const beside = zoneProps.settings?.pilesBesideHand ?? true
  const titles = { graveyard: 'Cimetière', exile: 'Exil' }
  return (
    <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-2 p-2" data-board={zoneProps.player}>
      <PlayerColumn {...zoneProps} me={me} portrait={portrait} onLibraryMenu={onLibraryMenu} onPile={onPile} piles={!beside} />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
        <Battlefield {...zoneProps} />
        <div className={`h-[38%] sm:h-[25%] min-h-[96px] ${beside ? 'phone:h-[220px]' : ''} shrink-0 flex ${beside ? 'flex-col sm:flex-row gap-2' : ''}`}>
          <Hand {...zoneProps} onZoneContextMenu={onHandMenu} />
          {beside && (
            <PileTiles {...zoneProps} me={me} onLibraryMenu={onLibraryMenu} onPile={(zone) => onPile(zone, titles[zone])}
              className="h-14 sm:h-auto phone:h-[84px] shrink-0 sm:py-1 max-sm:order-first" />
          )}
        </div>
      </div>
    </div>
  )
}
