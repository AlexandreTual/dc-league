'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { startCheck, type GameTable } from '@/lib/db-games'
import { useT } from '@/components/i18n/I18nProvider'
import { translateGameError } from '@/lib/i18n/game-errors'
import { tableShareText } from '@/lib/share'
import ShareButton from '@/components/ShareButton'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'

const REFRESH_MS = 3000
const smallButton = 'px-3 py-1.5 rounded-lg text-sm border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40'

/** Salle d'attente : places, choix du deck, lien d'invitation, départ par l'hôte. Rafraîchie toutes les 3 s. */
export default function WaitingRoom({ me, table, myDecks, onChange }: {
  me: string
  table: GameTable
  myDecks: { id: string; name: string }[]
  onChange: (table: GameTable) => void
}) {
  const t = useT()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  /** Premier joueur choisi par l'hôte ; vide : tirage au sort. */
  const [first, setFirst] = useState('')

  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await fetch(`/api/games/${table.id}`).catch(() => null)
      if (res?.status === 404) return router.push('/salon')
      if (res?.ok) onChange((await res.json()) as GameTable)
    }, REFRESH_MS)
    return () => clearInterval(timer)
  }, [table.id, onChange, router])

  const players = table.players ?? []
  const seat = players.find((p) => p.playerId === me)
  const isHost = table.hostPlayerId === me
  const blocker = startCheck(table)
  // Un joueur choisi qui quitte la table : retour au tirage au sort.
  const firstPlayer = players.some((p) => p.playerId === first) ? first : ''

  async function post(path: string, body?: unknown): Promise<GameTable | null> {
    setBusy(true)
    const { error, data } = await sendJson(`/api/games/${table.id}/${path}`, 'POST', body)
    setBusy(false)
    setError(error)
    if (error) return null
    if (data && typeof data === 'object' && 'id' in data) onChange(data as GameTable)
    return data as GameTable | null
  }

  async function leave() {
    setBusy(true)
    const { error } = await sendJson(`/api/games/${table.id}/leave`, 'POST')
    setBusy(false)
    if (error) return setError(error)
    router.push('/salon')
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError(t.online.waiting.copyFailed)
    }
  }

  function shareData() {
    const host = players.find((p) => p.playerId === table.hostPlayerId)
    return {
      title: t.common.siteName,
      text: tableShareText({ format: table.format, seats: table.seats, hostName: host?.name }, t),
      url: window.location.href,
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-fantasy text-2xl font-bold text-dc-gold flex-1">{t.online.formats[table.format]}</h1>
        <div className="flex gap-2">
          <ShareButton className={`${smallButton} whitespace-nowrap`} getData={shareData} />
          <button className={`${smallButton} whitespace-nowrap`} onClick={copyLink}>
            <LinkIcon className="inline w-4 h-4 mr-1" />{copied ? t.online.waiting.linkCopied : t.online.waiting.copyLink}
          </button>
        </div>
      </div>
      {error && <p className={errorClass}>{error}</p>}

      <section className={cardClass}>
        <h2 className="font-fantasy text-dc-gold">{t.online.waiting.players(table.players.length, table.seats)}</h2>
        <ul className="divide-y divide-dc-border" data-testid="seats">
          {table.players.map((p) => (
            <li key={p.playerId} className="py-2 flex items-center gap-3 text-sm" data-seat={p.playerId}>
              <span className="w-6 text-dc-muted">{p.seat}</span>
              <span className="flex-1 text-dc-text">
                {p.name}
                {p.playerId === table.hostPlayerId && <Crown className="inline w-4 h-4 ml-1 text-dc-gold" aria-label={t.online.waiting.host} />}
              </span>
              <span className={p.deckName ? 'text-dc-text' : 'text-dc-muted italic'}>{p.deckName ?? t.online.waiting.deckToChoose}</span>
              {isHost && p.playerId !== me && (
                <button className={smallButton} disabled={busy} onClick={() => post('kick', { playerId: p.playerId })}>{t.online.waiting.kick}</button>
              )}
            </li>
          ))}
        </ul>
        {table.eliminatedSeeAll && <p className="text-dc-muted text-xs">{t.online.waiting.seeAll}</p>}
      </section>

      {seat ? (
        <section className={cardClass}>
          <label>
            <span className={labelClass}>{t.online.waiting.myDeck}</span>
            <select className={inputClass} value={seat.deckId ?? ''} disabled={busy} onChange={(e) => post('deck', { deckId: e.target.value })} data-testid="deck-select">
              <option value="" disabled>{t.online.waiting.chooseDeck}</option>
              {myDecks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          {myDecks.length === 0 && (
            <p className="text-dc-muted text-sm">
              {t.online.waiting.importFirst}
              <Link href="/profil/decks" className="text-dc-gold underline">{t.online.waiting.myDecks}</Link>
              {t.online.waiting.importFirstAfter}
            </p>
          )}
          {isHost && (
            <>
              <label>
                <span className={labelClass}>{t.online.waiting.whoStarts}</span>
                <select className={inputClass} value={firstPlayer} disabled={busy} onChange={(e) => setFirst(e.target.value)} data-testid="first-player-select">
                  <option value="">{t.online.waiting.randomDraw}</option>
                  {table.players.map((p) => <option key={p.playerId} value={p.playerId}>{p.name}</option>)}
                </select>
              </label>
              <button className={primaryButtonClass} disabled={busy || blocker !== null} onClick={() => post('start', firstPlayer ? { firstPlayer } : undefined)}>{t.online.waiting.start}</button>
              {blocker && <p className="text-dc-muted text-sm text-center">{translateGameError(blocker, t)}</p>}
            </>
          )}
          {!isHost && <p className="text-dc-muted text-sm text-center">{t.online.waiting.waitingHost}</p>}
          <button className={smallButton} disabled={busy} onClick={leave}>{t.online.waiting.leave}</button>
        </section>
      ) : (
        <section className={cardClass}>
          <button className={primaryButtonClass} disabled={busy || table.players.length >= table.seats} onClick={() => post('join')}>
            {table.players.length >= table.seats ? t.online.waiting.tableFull : t.online.waiting.joinTable}
          </button>
        </section>
      )}
    </div>
  )
}
