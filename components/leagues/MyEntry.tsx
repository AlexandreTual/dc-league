'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Layers } from 'lucide-react'
import Link from 'next/link'
import { errorClass, sendJson } from '@/components/formStyles'

/** Pour un inscrit : choisir son deck pour la ligue, et la quitter tant que les matchs ne sont pas générés. */
export default function MyEntry({
  leagueId, playerId, decks, deckId, canLeave,
}: {
  leagueId: string
  playerId: string
  decks: { id: string; name: string }[]
  deckId: string | null
  canLeave: boolean
}) {
  const router = useRouter()
  const [current, setCurrent] = useState(deckId ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const url = `/api/leagues/${leagueId}/players/${playerId}`

  async function chooseDeck(id: string) {
    const previous = current
    setCurrent(id)
    setError('')
    setSaved(false)
    const { error } = await sendJson(url, 'PATCH', { deck_id: id || null })
    if (error) {
      setCurrent(previous)
      return setError(error)
    }
    setSaved(true)
    router.refresh()
  }

  async function leave() {
    setConfirmLeave(false)
    const { error } = await sendJson(url, 'DELETE')
    if (error) return setError(error)
    router.push('/ligues')
    router.refresh()
  }

  return (
    <section aria-label="Ma participation" className="bg-dc-surface border border-dc-border rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="my-deck" className="inline-flex items-center gap-1.5 text-sm text-dc-muted">
          <Layers className="w-4 h-4 text-dc-gold" /> Mon deck pour cette ligue
        </label>
        {decks.length === 0 ? (
          <Link href="/profil/decks" className="text-dc-gold text-sm hover:underline">Importer un deck</Link>
        ) : (
          <select
            id="my-deck"
            value={current}
            onChange={(e) => chooseDeck(e.target.value)}
            className="bg-dc-bg border border-dc-border rounded-lg px-3 py-2 text-dc-text text-sm focus:outline-none focus:border-dc-gold/50 min-w-0 flex-1 sm:flex-none"
          >
            <option value="">Aucun deck</option>
            {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {saved && <span role="status" className="text-dc-green-light text-xs">Enregistré</span>}
        {canLeave && (
          confirmLeave ? (
            <span className="inline-flex items-center gap-1.5 text-xs sm:ml-auto">
              <span className="text-dc-red-light">Quitter la ligue ?</span>
              <button onClick={leave} className="px-3 py-2 bg-dc-red/20 border border-dc-red/40 text-dc-red-light rounded-lg">Oui</button>
              <button onClick={() => setConfirmLeave(false)} className="px-3 py-2 border border-dc-border/50 text-dc-muted rounded-lg">Non</button>
            </span>
          ) : (
            <button onClick={() => setConfirmLeave(true)} className="inline-flex items-center gap-1.5 text-dc-muted hover:text-dc-red-light text-xs px-3 py-2 border border-dc-border/50 rounded-lg sm:ml-auto">
              <LogOut className="w-3.5 h-3.5" /> Quitter la ligue
            </button>
          )
        )}
      </div>
      {error && <p className={errorClass}>{error}</p>}
    </section>
  )
}
