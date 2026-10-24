'use client'

import type { MenuPoint } from './touch'
import { PileTiles } from './PileCases'
import PlayerColumn from './PlayerColumn'
import { Battlefield, Hand, type ZoneProps } from './zones'
import { useT } from '@/components/i18n/I18nProvider'
import { handRowStyle } from '@/lib/table-settings'

/**
 * Mon plateau : ma colonne à gauche, puis mon champ de bataille et ma main sur toute la largeur restante.
 * Par défaut, bibliothèque, cimetière, exil et commandement en vignettes à droite de la main (au-dessus sous 640 px),
 * et la colonne garde la ligne portrait puis le cimetière en liste ; réglage « Piles dans la colonne » : l'ancienne disposition.
 * Réglage « Taille de la main » : hauteur de la bande main + piles. À la souris, les vignettes ne dépassent pas 14 % de
 * la largeur de la bande en hauteur (environ un tiers de sa largeur à elles quatre, au moins 72 px) : sur un écran étroit, la main garde la place.
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
        <div style={handRowStyle(zoneProps.settings?.handScale ?? 1) as React.CSSProperties} data-hand-row
          className={`h-[calc(38%*var(--hand-scale))] sm:h-[calc(25%*var(--hand-scale))] min-h-[calc(96px*var(--hand-scale))] shrink-0 flex [container-type:inline-size] ${beside ? 'flex-col sm:flex-row gap-2' : ''}`}>
          <Hand {...zoneProps} onZoneContextMenu={onHandMenu} />
          {beside && (
            <PileTiles {...zoneProps} me={me} onLibraryMenu={onLibraryMenu} onPile={(zone) => onPile(zone, titles[zone])} graveyardListed
              className="h-14 sm:h-auto sm:[@media(pointer:fine)]:h-[min(100%,max(72px,14cqw))] sm:[@media(pointer:fine)]:self-end shrink-0 sm:py-1 max-sm:order-first" />
          )}
        </div>
      </div>
    </div>
  )
}
