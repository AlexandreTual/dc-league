'use client'

import { useState } from 'react'
import type { GameTable } from '@/lib/db-games'
import WaitingRoom from './WaitingRoom'

/** Salle d'attente tant que la table est ouverte, puis la partie. */
export default function TableView({ me, initialTable, myDecks }: {
  me: string
  initialTable: GameTable
  myDecks: { id: string; name: string }[]
}) {
  const [table, setTable] = useState(initialTable)
  if (table.status === 'open') return <WaitingRoom me={me} table={table} myDecks={myDecks} onChange={setTable} />
  return <p className="text-dc-muted">Partie en cours…</p>
}
