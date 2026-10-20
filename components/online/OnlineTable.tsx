'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import type { DeckToken } from '@/lib/game/types'
import Table from '@/components/table/Table'
import { useRemoteSource } from '@/components/table/useRemoteSource'
import { useT } from '@/components/i18n/I18nProvider'
import { translateGameError } from '@/lib/i18n/game-errors'
import { SOCKET_MSG } from './reconnect'

const smallButton = 'px-3 py-1.5 rounded-lg text-sm border border-dc-gold/40 text-dc-gold bg-dc-gold/10 hover:bg-dc-gold/20'

/** Partie en ligne : la table alimentée par la connexion au serveur de jeu, en plein écran (au-dessus de la barre du site). */
export default function OnlineTable({ tableId }: { tableId: string }) {
  const t = useT()
  const { source: remote, closedReason, retry } = useRemoteSource(tableId)
  const deckTokens = useDeckTokens(tableId)
  const source = useMemo(() => remote && { ...remote, deckTokens }, [remote, deckTokens])
  return (
    <div className="fixed inset-0 z-[60] bg-dc-bg" data-testid="game" data-table-root>
      {closedReason ? (
        <div className="flex flex-col items-center gap-4 py-16 px-4 text-center" data-testid="connection-closed">
          <p className="text-dc-text">{translateGameError(closedReason, t)}</p>
          <div className="flex gap-3">
            {closedReason !== SOCKET_MSG.gone && <button className={smallButton} onClick={retry}>{t.online.connection.retry}</button>}
            <Link className={smallButton} href="/salon">{t.online.connection.backToLobby}</Link>
          </div>
        </div>
      ) : source ? (
        <Table source={source} />
      ) : (
        <p className="text-dc-muted text-center py-16">{t.online.connection.connecting}</p>
      )}
    </div>
  )
}

/** Jetons de mon deck à cette table ; en cas d'échec, « Créer un jeton » s'ouvre simplement sur Scryfall. */
function useDeckTokens(tableId: string): DeckToken[] | undefined {
  const [tokens, setTokens] = useState<DeckToken[]>()
  useEffect(() => {
    let cancelled = false
    fetch(`/api/games/${tableId}/tokens`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) setTokens(data as DeckToken[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [tableId])
  return tokens
}
