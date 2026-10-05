'use client'

import Table from '@/components/table/Table'
import { useRemoteSource } from '@/components/table/useRemoteSource'

/** Partie en ligne : la table alimentée par la connexion au serveur de jeu, en plein écran (au-dessus de la barre du site). */
export default function OnlineTable({ tableId }: { tableId: string }) {
  const source = useRemoteSource(tableId)
  return (
    <div className="fixed inset-0 z-[60] bg-dc-bg" data-testid="game" data-table-root>
      {source ? <Table source={source} /> : <p className="text-dc-muted text-center py-16">Connexion à la partie…</p>}
    </div>
  )
}
