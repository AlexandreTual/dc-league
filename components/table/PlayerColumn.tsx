'use client'

import type { MenuPoint } from './touch'
import { CommandBlock, GraveyardCascade, PileCases } from './PileCases'
import type { ZoneProps } from './zones'

/**
 * Colonne d'un joueur, à gauche de son plateau : ligne portrait (vie en gros), cases chiffrées,
 * commandant et cimetière en cascade. Sous 640 px : une ligne au-dessus de la main (portrait et cases).
 */
export default function PlayerColumn(props: ZoneProps & {
  me: string | null
  /** Ligne portrait (`PlayerPortrait`), construite par la table. */
  portrait: React.ReactNode
  onLibraryMenu: (at: MenuPoint) => void
  onPile: (zone: 'graveyard' | 'exile', title: string) => void
}) {
  const { portrait, onPile, ...zoneProps } = props
  const titles = { graveyard: 'Cimetière', exile: 'Exil' }
  return (
    <div className="sm:w-[216px] shrink-0 min-h-0 flex max-sm:flex-row max-sm:items-center flex-col gap-1 rounded-xl border border-dc-border bg-dc-surface/60 p-1.5"
      data-column={props.player}>
      <div className="max-sm:flex-1 max-sm:min-w-0">{portrait}</div>
      <div className="max-sm:w-48 shrink-0">
        <PileCases {...zoneProps} onPile={(zone) => onPile(zone, titles[zone])} />
      </div>
      <div className="max-sm:hidden"><CommandBlock {...zoneProps} /></div>
      <GraveyardCascade {...zoneProps} className="shrink max-sm:hidden" onOpen={() => onPile('graveyard', titles.graveyard)} />
    </div>
  )
}
