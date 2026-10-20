'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Swords } from 'lucide-react'
import type { GameTable, TableStatus } from '@/lib/db-games'
import { IDLE_AFTER_MS, idleFor, idleLabel } from '@/lib/games/idle'
import type { AdminApi } from './useAdminApi'
import { useT } from '@/components/i18n/I18nProvider'

type Props = { initial: GameTable[]; call: AdminApi['call']; onToast: (msg: string) => void }

/** Section « Parties en cours » : tables non terminées, suppression des parties abandonnées. */
export default function GamesPanel({ initial, call, onToast }: Props) {
  const [tables, setTables] = useState(initial)
  const [busy, setBusy] = useState(false)
  const messages = useT()
  const tg = messages.admin.games
  const STATUS: Record<TableStatus, string> = tg.status
  const now = new Date()
  const idle = tables.filter((t) => idleFor(t.lastActivityAt, now) > IDLE_AFTER_MS)

  /** Supprime les tables une à une ; renvoie le nombre supprimé (arrêt à la première erreur, déjà affichée). */
  async function remove(ids: string[]): Promise<number> {
    setBusy(true)
    let removed = 0
    for (const id of ids) {
      const { ok } = await call(`/api/admin/games/${id}`, 'DELETE')
      if (!ok) break
      removed++
      setTables((list) => list.filter((t) => t.id !== id))
    }
    setBusy(false)
    return removed
  }

  async function removeOne(t: GameTable) {
    const names = t.players.map((p) => p.name).join(', ')
    if (!confirm(tg.confirmOne(names))) return
    if ((await remove([t.id])) === 1) onToast(tg.removedOne)
  }

  async function removeIdle() {
    if (!confirm(tg.confirmIdle(idle.length))) return
    const removed = await remove(idle.map((t) => t.id))
    if (removed > 0) onToast(tg.removed(removed))
  }

  return (
    <section className="space-y-3" aria-labelledby="parties-en-cours" data-testid="games-admin">
      <h2 id="parties-en-cours" className="font-fantasy font-bold text-dc-text flex items-center gap-2">
        <Swords className="w-5 h-5 text-dc-gold" /> {tg.title(tables.length)}
      </h2>
      <p className="text-dc-muted text-sm">
        {tg.help}
      </p>
      {idle.length > 0 && (
        <button
          onClick={removeIdle}
          disabled={busy}
          className="px-4 py-2 rounded-xl border border-dc-red/40 text-dc-red-light hover:bg-dc-red/10 disabled:opacity-50 text-sm"
        >
          {tg.removeIdle(idle.length)}
        </button>
      )}
      {tables.length === 0 ? (
        <p className="text-dc-muted text-sm">{tg.none}</p>
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
                    <span className={since > IDLE_AFTER_MS ? 'text-dc-red-light' : undefined} suppressHydrationWarning>{tg.activity(idleLabel(since, messages))}</span>
                  </p>
                </div>
                <button
                  onClick={() => removeOne(t)}
                  disabled={busy}
                  className="px-3 py-1.5 rounded-xl border border-dc-red/40 text-dc-red-light hover:bg-dc-red/10 disabled:opacity-50"
                >
                  {tg.remove}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
