'use client'

import { useEffect, useState } from 'react'
import { Flag } from 'lucide-react'
import type { ClientAction } from '@/lib/game/room'
import type { PlayerView } from '@/lib/game/types'
import DungeonMap from './DungeonMap'
import { onDungeonRequest, venture, type DungeonRequest } from './dungeon'

const button = 'px-3 h-8 tablet:h-11 rounded-lg border text-sm'

/**
 * Donjons à la table : plan ouvert à la demande (portrait, bulle) et, chez le joueur qui a l'initiative,
 * l'exploration des Souterrains proposée (prise d'initiative, début de son tour) : « Explorer » ou « Plus tard ».
 */
export default function DungeonHost({ view, canAct, animate, offers, send }: {
  view: PlayerView
  canAct: boolean
  animate: boolean
  /** Afficher la proposition (pas dans la fenêtre à part du plateau d'un adversaire). */
  offers: boolean
  send: (action: ClientAction) => void
}) {
  const [request, setRequest] = useState<DungeonRequest | null>(null)
  useEffect(() => onDungeonRequest((r) => setRequest(r)), [])
  const me = view.players[view.me]
  const offered = offers && canAct && !!me && !me.eliminated && (view.ventureOffers ?? []).includes(view.me)

  return (
    <>
      {offered && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 flex flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-xl bg-dc-surface/95 border border-dc-gold shadow-card max-w-[90%]"
          role="status" data-testid="venture-offer">
          <Flag className="w-4 h-4 text-dc-gold shrink-0" />
          <span className="text-sm text-dc-text">Initiative : explorer Les Souterrains ?</span>
          <button className={`${button} border-dc-gold bg-dc-gold/20 text-dc-gold`} onClick={() => venture(view, 'undercity', send)} data-testid="venture-offer-go">Explorer</button>
          <button className={`${button} border-dc-border text-dc-muted hover:text-dc-text`} onClick={() => send({ type: 'skipVenture' })} data-testid="venture-offer-skip">Plus tard</button>
        </div>
      )}
      {request && <DungeonMap key={JSON.stringify(request)} view={view} request={request} canAct={canAct} animate={animate} send={send} onClose={() => setRequest(null)} />}
    </>
  )
}
