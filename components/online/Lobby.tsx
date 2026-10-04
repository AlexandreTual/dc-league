'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GameTable } from '@/lib/db-games'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'

const REFRESH_MS = 5000
const FORMAT_LABELS = { commander: 'Commander', duel: 'Duel Commander' } as const
const smallButton = 'px-3 py-1.5 rounded-lg text-sm border border-dc-gold/40 text-dc-gold bg-dc-gold/10 hover:bg-dc-gold/20'

/** Salon : tables ouvertes (à rejoindre) et en cours (à regarder), création d'une table. */
export default function Lobby({ me, initialTables }: { me: string; initialTables: GameTable[] }) {
  const router = useRouter()
  const [tables, setTables] = useState(initialTables)
  const [format, setFormat] = useState<'commander' | 'duel'>('commander')
  const [seats, setSeats] = useState(4)
  const [seeAll, setSeeAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch('/api/games').catch(() => null)
      if (res?.ok) setTables((await res.json()) as GameTable[])
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error, data } = await sendJson('/api/games', 'POST', { format, seats, eliminatedSeeAll: seeAll })
    setBusy(false)
    if (error) return setError(error)
    router.push(`/tables/${(data as GameTable).id}`)
  }

  async function join(id: string) {
    const { error } = await sendJson(`/api/games/${id}/join`, 'POST')
    if (error) return setError(error)
    router.push(`/tables/${id}`)
  }

  const open = tables.filter((t) => t.status === 'open')
  const playing = tables.filter((t) => t.status === 'playing')

  return (
    <div className="space-y-6">
      {error && <p className={errorClass}>{error}</p>}

      <section className={cardClass}>
        <h2 className="font-fantasy text-dc-gold">Tables ouvertes</h2>
        {open.length === 0 && <p className="text-dc-muted text-sm">Aucune table ouverte pour l&apos;instant.</p>}
        <ul className="divide-y divide-dc-border" data-testid="open-tables">
          {open.map((t) => {
            const seated = t.players.some((p) => p.playerId === me)
            const host = t.players.find((p) => p.playerId === t.hostPlayerId)?.name ?? '?'
            return (
              <li key={t.id} className="py-2 flex items-center gap-3" data-table-id={t.id}>
                <div className="flex-1 text-sm">
                  <p className="text-dc-text">{FORMAT_LABELS[t.format]} · table de {host}</p>
                  <p className="text-dc-muted">{t.players.length}/{t.seats} joueurs : {t.players.map((p) => p.name).join(', ')}</p>
                </div>
                {seated ? (
                  <button className={smallButton} onClick={() => router.push(`/tables/${t.id}`)}>Retourner à la table</button>
                ) : (
                  <button className={smallButton} disabled={t.players.length >= t.seats} onClick={() => join(t.id)}>
                    {t.players.length >= t.seats ? 'Complète' : 'Rejoindre'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className={cardClass}>
        <h2 className="font-fantasy text-dc-gold">Parties en cours</h2>
        {playing.length === 0 && <p className="text-dc-muted text-sm">Aucune partie en cours.</p>}
        <ul className="divide-y divide-dc-border">
          {playing.map((t) => {
            const seated = t.players.some((p) => p.playerId === me)
            return (
              <li key={t.id} className="py-2 flex items-center gap-3">
                <p className="flex-1 text-sm text-dc-text">{FORMAT_LABELS[t.format]} · {t.players.map((p) => p.name).join(', ')}</p>
                <button className={smallButton} onClick={() => router.push(`/tables/${t.id}`)}>{seated ? 'Reprendre' : 'Regarder'}</button>
              </li>
            )
          })}
        </ul>
      </section>

      <form className={cardClass} onSubmit={create}>
        <h2 className="font-fantasy text-dc-gold">Créer une table</h2>
        <div className="grid grid-cols-2 gap-4">
          <label>
            <span className={labelClass}>Format</span>
            <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value as 'commander' | 'duel')}>
              <option value="commander">Commander</option>
              <option value="duel">Duel Commander</option>
            </select>
          </label>
          {format === 'commander' && (
            <label>
              <span className={labelClass}>Places</span>
              <select className={inputClass} value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
                {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} joueurs</option>)}
              </select>
            </label>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-dc-text">
          <input type="checkbox" checked={seeAll} onChange={(e) => setSeeAll(e.target.checked)} />
          Un joueur éliminé voit toutes les cartes
        </label>
        <button className={primaryButtonClass} disabled={busy}>Créer la table</button>
      </form>
    </div>
  )
}
