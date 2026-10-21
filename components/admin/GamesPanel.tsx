'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Swords } from 'lucide-react'
import type { GameTable, TableStatus } from '@/lib/db-games'
import { IDLE_AFTER_MS, idleFor, idleLabel } from '@/lib/games/idle'
import type { AdminApi } from './useAdminApi'

const STATUS: Record<TableStatus, string> = { open: 'En attente', starting: 'Démarrage', playing: 'En cours', finished: 'Terminée' }

type Props = { initial: GameTable[]; call: AdminApi['call']; onToast: (msg: string) => void }

/** Section « Parties en cours » : tables non terminées, suppression des parties abandonnées. */
export default function GamesPanel({ initial, call, onToast }: Props) {
  const [tables, setTables] = useState(initial)
  const [busy, setBusy] = useState(false)
  const now = new Date()
  const idle = tables.filter((t) => idleFor(t.lastActivityAt, now) > IDLE_AFTER_MS)

  /**
   * Supprime les tables une à une ; renvoie le nombre supprimé (arrêt à la première erreur, déjà affichée).
   * `idleOnly` : le serveur refuse une table redevenue active depuis le chargement de la liste.
   */
  async function remove(ids: string[], idleOnly = false): Promise<number> {
    setBusy(true)
    let removed = 0
    for (const id of ids) {
      const { ok } = await call(`/api/admin/games/${id}${idleOnly ? '?inactive=1' : ''}`, 'DELETE')
      if (!ok) break
      removed++
      setTables((list) => list.filter((t) => t.id !== id))
    }
    setBusy(false)
    return removed
  }

  async function removeOne(t: GameTable) {
    const names = t.players.map((p) => p.name).join(', ')
    if (!confirm(`Supprimer la partie de ${names} ? Les joueurs connectés seront déconnectés.`)) return
    if ((await remove([t.id])) === 1) onToast('Partie supprimée')
  }

  /** Relit la liste avant de demander la confirmation : une partie reprise entre-temps n'est plus proposée. */
  async function removeIdle() {
    setBusy(true)
    const { ok, data } = await call<GameTable[]>('/api/admin/games', 'GET')
    setBusy(false)
    if (!ok || !data) return
    setTables(data)
    const fresh = data.filter((t) => idleFor(t.lastActivityAt, new Date()) > IDLE_AFTER_MS)
    if (fresh.length === 0) {
      onToast('Aucune partie inactive depuis plus de 24 h')
      return
    }
    if (!confirm(`Supprimer ${fresh.length === 1 ? 'la partie inactive' : `les ${fresh.length} parties inactives`} depuis plus de 24 h ?`)) return
    const removed = await remove(fresh.map((t) => t.id), true)
    if (removed > 0) onToast(`${removed} partie${removed > 1 ? 's' : ''} supprimée${removed > 1 ? 's' : ''}`)
  }

  return (
    <section className="space-y-3" aria-labelledby="parties-en-cours" data-testid="games-admin">
      <h2 id="parties-en-cours" className="font-fantasy font-bold text-dc-text flex items-center gap-2">
        <Swords className="w-5 h-5 text-dc-gold" /> Parties en cours ({tables.length})
      </h2>
      <p className="text-dc-muted text-sm">
        Tables en ligne pas encore terminées. Supprimer une partie la retire du salon et déconnecte ses joueurs, sans vainqueur.
        Les tables inactives depuis 7 jours sont supprimées chaque nuit.
      </p>
      {idle.length > 0 && (
        <button
          onClick={removeIdle}
          disabled={busy}
          className="px-4 py-2 rounded-xl border border-dc-red/40 text-dc-red-light hover:bg-dc-red/10 disabled:opacity-50 text-sm"
        >
          {idle.length === 1 ? 'Supprimer la partie inactive' : `Supprimer les ${idle.length} parties inactives`} depuis plus de 24 h
        </button>
      )}
      {tables.length === 0 ? (
        <p className="text-dc-muted text-sm">Aucune partie en cours.</p>
      ) : (
        <ul className="space-y-2">
          {tables.map((t) => {
            const since = idleFor(t.lastActivityAt, now)
            return (
              <li key={t.id} data-testid="games-admin-row" className="bg-dc-surface border border-dc-border rounded-2xl p-3 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <Link href={`/tables/${t.id}`} className="font-semibold text-dc-text hover:text-dc-gold break-words">
                    {t.players.map((p) => p.name).join(', ')}
                  </Link>
                  <p className="text-dc-muted text-xs">
                    {STATUS[t.status]} · {t.format === 'duel' ? 'Duel' : 'Commander'} ·{' '}
                    <span className={since > IDLE_AFTER_MS ? 'text-dc-red-light' : undefined} suppressHydrationWarning>activité {idleLabel(since)}</span>
                  </p>
                </div>
                <button
                  onClick={() => removeOne(t)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-xl border border-dc-red/40 text-dc-red-light hover:bg-dc-red/10 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
