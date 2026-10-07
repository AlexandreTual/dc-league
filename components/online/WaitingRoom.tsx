'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Crown, Link as LinkIcon } from 'lucide-react'
import { startCheck, type GameTable } from '@/lib/db-games'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'

const REFRESH_MS = 3000
const FORMAT_LABELS = { commander: 'Commander', duel: 'Duel Commander' } as const
const smallButton = 'px-3 py-1.5 rounded-lg text-sm border border-dc-border text-dc-text hover:border-dc-gold/50 disabled:opacity-40'

/** Salle d'attente : places, choix du deck, lien d'invitation, départ par l'hôte. Rafraîchie toutes les 3 s. */
export default function WaitingRoom({ me, table, myDecks, onChange }: {
  me: string
  table: GameTable
  myDecks: { id: string; name: string }[]
  onChange: (table: GameTable) => void
}) {
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

  const seat = table.players.find((p) => p.playerId === me)
  const isHost = table.hostPlayerId === me
  const blocker = startCheck(table)
  // Un joueur choisi qui quitte la table : retour au tirage au sort.
  const firstPlayer = table.players.some((p) => p.playerId === first) ? first : ''

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
      setError('Copie impossible : copie l’adresse de la page')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="font-fantasy text-2xl font-bold text-dc-gold flex-1">{FORMAT_LABELS[table.format]}</h1>
        <button className={smallButton} onClick={copyLink}>
          <LinkIcon className="inline w-4 h-4 mr-1" />{copied ? 'Lien copié' : 'Copier le lien'}
        </button>
      </div>
      {error && <p className={errorClass}>{error}</p>}

      <section className={cardClass}>
        <h2 className="font-fantasy text-dc-gold">Joueurs ({table.players.length}/{table.seats})</h2>
        <ul className="divide-y divide-dc-border" data-testid="seats">
          {table.players.map((p) => (
            <li key={p.playerId} className="py-2 flex items-center gap-3 text-sm" data-seat={p.playerId}>
              <span className="w-6 text-dc-muted">{p.seat}</span>
              <span className="flex-1 text-dc-text">
                {p.name}
                {p.playerId === table.hostPlayerId && <Crown className="inline w-4 h-4 ml-1 text-dc-gold" aria-label="hôte" />}
              </span>
              <span className={p.deckName ? 'text-dc-text' : 'text-dc-muted italic'}>{p.deckName ?? 'deck à choisir'}</span>
              {isHost && p.playerId !== me && (
                <button className={smallButton} disabled={busy} onClick={() => post('kick', { playerId: p.playerId })}>Retirer</button>
              )}
            </li>
          ))}
        </ul>
        {table.eliminatedSeeAll && <p className="text-dc-muted text-xs">Un joueur éliminé voit toutes les cartes.</p>}
      </section>

      {seat ? (
        <section className={cardClass}>
          <label>
            <span className={labelClass}>Mon deck</span>
            <select className={inputClass} value={seat.deckId ?? ''} disabled={busy} onChange={(e) => post('deck', { deckId: e.target.value })} data-testid="deck-select">
              <option value="" disabled>Choisir un deck…</option>
              {myDecks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          {myDecks.length === 0 && <p className="text-dc-muted text-sm">Importe d&apos;abord la liste d&apos;un de tes decks (Profil → Mes decks).</p>}
          {isHost && (
            <>
              <label>
                <span className={labelClass}>Qui commence ?</span>
                <select className={inputClass} value={firstPlayer} disabled={busy} onChange={(e) => setFirst(e.target.value)} data-testid="first-player-select">
                  <option value="">Tirage au sort</option>
                  {table.players.map((p) => <option key={p.playerId} value={p.playerId}>{p.name}</option>)}
                </select>
              </label>
              <button className={primaryButtonClass} disabled={busy || blocker !== null} onClick={() => post('start', firstPlayer ? { firstPlayer } : undefined)}>Démarrer la partie</button>
              {blocker && <p className="text-dc-muted text-sm text-center">{blocker}</p>}
            </>
          )}
          {!isHost && <p className="text-dc-muted text-sm text-center">En attente du départ par l&apos;hôte…</p>}
          <button className={smallButton} disabled={busy} onClick={leave}>Quitter la table</button>
        </section>
      ) : (
        <section className={cardClass}>
          <button className={primaryButtonClass} disabled={busy || table.players.length >= table.seats} onClick={() => post('join')}>
            {table.players.length >= table.seats ? 'Table complète' : 'Rejoindre la table'}
          </button>
        </section>
      )}
    </div>
  )
}
