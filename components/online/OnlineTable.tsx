'use client'

import Table from '@/components/table/Table'
import { useRemoteSource } from '@/components/table/useRemoteSource'

/** Partie en ligne : la table alimentée par la connexion au serveur de jeu, en plein écran sous la navigation. */
export default function OnlineTable({ tableId }: { tableId: string }) {
  const source = useRemoteSource(tableId)
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-40 bg-dc-bg" data-testid="game">
      {source ? <Table source={source} /> : <p className="text-dc-muted text-center py-16">Connexion à la partie…</p>}
    </div>
  )
}
