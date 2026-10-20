'use client'

import type { MenuPoint } from './touch'
import { PileTiles } from './PileCases'
import PlayerColumn from './PlayerColumn'
import { Battlefield, Hand, type ZoneProps } from './zones'
import { useT } from '@/components/i18n/I18nProvider'

/**
 * Mon plateau : ma colonne à gauche, puis mon champ de bataille et ma main sur toute la largeur restante.
 * Par défaut, bibliothèque, cimetière, exil et commandement en vignettes à droite de la main (au-dessus sous 640 px),
 * et la colonne garde la ligne portrait puis le cimetière en liste ; réglage « Piles dans la colonne » : l'ancienne disposition.
 */
export default function MyBoard(props: Omit<ZoneProps, 'player'> & {
  player: string
  me: string
  /** Ma ligne portrait (vie, compteurs). */
  portrait: React.ReactNode
  onLibraryMenu: (at: MenuPoint) => void
  onHandMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
  /** Ma réserve de mana, en bas à gauche de mon champ de bataille. */
  mana?: React.ReactNode
}) {
  const { onLibraryMenu, onHandMenu, onPile, me, portrait, mana, ...zoneProps } = props
  const beside = zoneProps.settings?.pilesBesideHand ?? true
  const z = useT().table.zones
  const titles = { graveyard: z.graveyard, exile: z.exile }
  return (
    <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-2 p-2" data-board={zoneProps.player}>
      <PlayerColumn {...zoneProps} me={me} portrait={portrait} onLibraryMenu={onLibraryMenu} onPile={onPile} piles={!beside} />
      <div className="flex-1 min-w-0 min-h-0 flex flex-col gap-2">
        <Battlefield {...zoneProps} corner={mana} />
        <div className={`h-[38%] sm:h-[25%] min-h-[96px] shrink-0 flex ${beside ? 'flex-col sm:flex-row gap-2' : ''}`}>
          <Hand {...zoneProps} onZoneContextMenu={onHandMenu} />
          {beside && (
            <PileTiles {...zoneProps} me={me} onLibraryMenu={onLibraryMenu} onPile={(zone) => onPile(zone, titles[zone])} graveyardListed
              className="h-14 sm:h-auto shrink-0 sm:py-1 max-sm:order-first" />
          )}
        </div>
      </div>
    </div>
  )
}
