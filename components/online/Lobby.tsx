'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { GameTable } from '@/lib/db-games'
import { useT } from '@/components/i18n/I18nProvider'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'

const REFRESH_MS = 5000
const smallButton = 'px-3 py-1.5 rounded-lg text-sm border border-dc-gold/40 text-dc-gold bg-dc-gold/10 hover:bg-dc-gold/20'

/** Salon : tables ouvertes (à rejoindre) et en cours (à regarder), création d'une table. */
export default function Lobby({ me, initialTables }: { me: string; initialTables: GameTable[] }) {
  const t = useT()
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

  const open = tables.filter((table) => table.status === 'open')
  const playing = tables.filter((table) => table.status === 'playing')
  const formats = t.online.formats

  return (
    <div className="space-y-6">
      {error && <p className={errorClass}>{error}</p>}

      <section className={cardClass}>
        <h2 className="font-fantasy text-dc-gold">{t.online.lobby.openTables}</h2>
        {open.length === 0 && <p className="text-dc-muted text-sm">{t.online.lobby.noOpenTables}</p>}
        <ul className="divide-y divide-dc-border" data-testid="open-tables">
          {open.map((table) => {
            const seated = table.players.some((p) => p.playerId === me)
            const host = table.players.find((p) => p.playerId === table.hostPlayerId)?.name ?? '?'
            return (
              <li key={table.id} className="py-2 flex items-center gap-3" data-table-id={table.id}>
                <div className="flex-1 text-sm">
                  <p className="text-dc-text">{t.online.lobby.hostTable(formats[table.format], host)}</p>
                  <p className="text-dc-muted">{t.online.lobby.seatsLine(table.players.length, table.seats, table.players.map((p) => p.name).join(', '))}</p>
                </div>
                {seated ? (
                  <button className={smallButton} onClick={() => router.push(`/tables/${table.id}`)}>{t.online.lobby.backToTable}</button>
                ) : (
                  <button className={smallButton} disabled={table.players.length >= table.seats} onClick={() => join(table.id)}>
                    {table.players.length >= table.seats ? t.online.lobby.full : t.online.lobby.join}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className={cardClass}>
        <h2 className="font-fantasy text-dc-gold">{t.online.lobby.playing}</h2>
        {playing.length === 0 && <p className="text-dc-muted text-sm">{t.online.lobby.noPlaying}</p>}
        <ul className="divide-y divide-dc-border">
          {playing.map((table) => {
            const seated = table.players.some((p) => p.playerId === me)
            return (
              <li key={table.id} className="py-2 flex items-center gap-3">
                <p className="flex-1 text-sm text-dc-text">{formats[table.format]} · {table.players.map((p) => p.name).join(', ')}</p>
                <button className={smallButton} onClick={() => router.push(`/tables/${table.id}`)}>{seated ? t.online.lobby.resume : t.online.lobby.watch}</button>
              </li>
            )
          })}
        </ul>
      </section>

      <form className={cardClass} onSubmit={create}>
        <h2 className="font-fantasy text-dc-gold">{t.online.lobby.create}</h2>
        <div className="grid grid-cols-2 gap-4">
          <label>
            <span className={labelClass}>{t.online.lobby.format}</span>
            <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value as 'commander' | 'duel')}>
              <option value="commander">{formats.commander}</option>
              <option value="duel">{formats.duel}</option>
            </select>
          </label>
          {format === 'commander' && (
            <label>
              <span className={labelClass}>{t.online.lobby.seats}</span>
              <select className={inputClass} value={seats} onChange={(e) => setSeats(Number(e.target.value))}>
                {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{t.online.lobby.players(n)}</option>)}
              </select>
            </label>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-dc-text">
          <input type="checkbox" checked={seeAll} onChange={(e) => setSeeAll(e.target.checked)} />
          {t.online.lobby.seeAll}
        </label>
        <button className={primaryButtonClass} disabled={busy}>{t.online.lobby.createButton}</button>
      </form>
    </div>
  )
}
