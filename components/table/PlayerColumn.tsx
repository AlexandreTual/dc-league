'use client'

import type { MenuPoint } from './touch'
import { CommandBlock, GraveyardCascade, PileCases } from './PileCases'
import type { ZoneProps } from './zones'

/**
 * Colonne d'un joueur, à gauche de son plateau : ligne portrait (vie en gros), cases chiffrées,
 * commandant et cimetière en cascade. Sur tablette, 188 px de large. Sous 640 px : une ligne au-dessus de la main (portrait et cases).
 * `piles={false}` : la ligne portrait seule (piles en vignettes à côté de la main).
 */
export default function PlayerColumn(props: ZoneProps & {
  me: string | null
  /** Ligne portrait (`PlayerPortrait`), construite par la table. */
  portrait: React.ReactNode
  onLibraryMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
  piles?: boolean
}) {
  const { portrait, onPile, piles = true, ...zoneProps } = props
  const titles = { graveyard: 'Cimetière', exile: 'Exil' }
  return (
    <div className={`sm:w-[216px] tablet:sm:w-[188px] shrink-0 min-h-0 flex max-sm:flex-row max-sm:items-center flex-col gap-1 rounded-xl border border-dc-border bg-dc-surface/60 p-1.5 ${piles ? '' : 'sm:self-start'}`}
      data-column={props.player}>
      <div className="max-sm:flex-1 max-sm:min-w-0">{portrait}</div>
      {piles && <>
      <div className="max-sm:w-48 shrink-0">
        <PileCases {...zoneProps} onPile={(zone) => onPile(zone, titles[zone])} />
      </div>
      {/* Hauteur trop juste (adversaire en haut, sur tablette) : la cascade se replie d'abord, puis le commandant ; jamais de débordement.
          p-0.5 -m-0.5 : le cadre doré de dépôt (ring-2) reste visible malgré overflow-hidden. */}
      <div className="max-sm:hidden min-h-0 shrink overflow-hidden p-0.5 -m-0.5"><CommandBlock {...zoneProps} /></div>
      <GraveyardCascade {...zoneProps} className="shrink-[100] max-sm:hidden" onOpen={() => onPile('graveyard', titles.graveyard)} />
      </>}
    </div>
  )
}
