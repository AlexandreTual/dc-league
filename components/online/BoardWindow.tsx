'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import Table from '@/components/table/Table'
import { useRemoteSource } from '@/components/table/useRemoteSource'
import { useBoardWindowAnnounce } from '@/components/table/useBoardWindows'
import { useT } from '@/components/i18n/I18nProvider'
import { translateGameError } from '@/lib/i18n/game-errors'
import { SOCKET_MSG } from './reconnect'

const smallButton = 'px-3 py-1.5 rounded-lg text-sm border border-dc-gold/40 text-dc-gold bg-dc-gold/10 hover:bg-dc-gold/20'

/**
 * Fenêtre à part : le plateau d'un adversaire seul, avec sa propre connexion au serveur de jeu
 * (même vue filtrée que la table). Elle se signale à la table, qui retire ce plateau tant qu'elle est ouverte.
 */
export default function BoardWindow({ tableId, player }: { tableId: string; player: string }) {
  const t = useT()
  const { source, closedReason, retry } = useRemoteSource(tableId)
  const valid = source !== null && player !== source.me && player in source.view.players
  const onReturn = useBoardWindowAnnounce(tableId, player, valid)
  const name = source?.view.players[player]?.name
  useEffect(() => {
    if (name) document.title = t.online.boardWindow.title(name)
  }, [name, t])
  return (
    <div className="fixed inset-0 z-[60] bg-dc-bg" data-testid="board-window" data-table-root>
      {closedReason ? (
        <div className="flex flex-col items-center gap-4 py-16 px-4 text-center" data-testid="connection-closed">
          <p className="text-dc-text">{translateGameError(closedReason, t)}</p>
          <div className="flex gap-3">
            {closedReason !== SOCKET_MSG.gone && <button className={smallButton} onClick={retry}>{t.online.connection.retry}</button>}
            <Link className={smallButton} href={`/tables/${tableId}`}>{t.online.connection.backToTable}</Link>
          </div>
        </div>
      ) : !source ? (
        <p className="text-dc-muted text-center py-16">{t.online.connection.connecting}</p>
      ) : !valid ? (
        <div className="flex flex-col items-center gap-4 py-16 px-4 text-center" data-testid="board-window-unknown">
          <p className="text-dc-text">{t.online.boardWindow.unknown}</p>
          <Link className={smallButton} href={`/tables/${tableId}`}>{t.online.connection.backToTable}</Link>
        </div>
      ) : (
        <Table source={source} boardWindow={{ player, onReturn }} />
      )}
    </div>
  )
}
