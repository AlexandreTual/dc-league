'use client'

import { RotateCcw } from 'lucide-react'
import type { RematchOffer } from './rematch'
import { useT } from '@/components/i18n/I18nProvider'
import { fr, type Messages } from '@/lib/i18n/messages'

const button = 'inline-flex items-center gap-1 px-3 py-1 rounded-lg font-sans text-sm border border-dc-gold/40 text-dc-gold bg-dc-gold/10 hover:bg-dc-gold/20 disabled:opacity-40'

/** Libellé du bouton de revanche selon ce qui est déjà proposé. */
export function rematchLabel(offer: RematchOffer | null, t: Messages = fr): string {
  const r = t.online.rematch
  if (!offer) return r.rematch
  return offer.seated ? r.open : r.join
}

/** Bandeau de fin : « Revanche », ou « Ana propose une revanche : Rejoindre ». */
export default function RematchBar({ offer, busy, error, onGo }: {
  offer: RematchOffer | null
  busy: boolean
  error: string | null
  onGo: () => void
}) {
  const r = useT().online.rematch
  return (
    <span className="flex flex-wrap items-center gap-2 font-sans text-sm text-dc-text" data-testid="rematch">
      {offer && !offer.seated && <span data-testid="rematch-offer">{r.offer(offer.hostName)}</span>}
      <button className={button} disabled={busy} onClick={onGo} data-testid="rematch-button">
        <RotateCcw className="w-3.5 h-3.5" />
        {offer ? (offer.seated ? r.open : r.joinShort) : busy ? r.starting : r.rematch}
      </button>
      {error && <span className="text-dc-red-light" role="alert">{error}</span>}
    </span>
  )
}
