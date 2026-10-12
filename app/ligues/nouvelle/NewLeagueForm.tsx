'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import type { DbLeague, LeagueVisibility } from '@/lib/db-leagues'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson } from '@/components/formStyles'
import VisibilityChoice from '@/components/leagues/VisibilityChoice'

export default function NewLeagueForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<LeagueVisibility>('public')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error, data } = await sendJson('/api/leagues', 'POST', { name: name.trim(), visibility })
      if (error) return setError(error)
      router.push(`/ligues/${(data as DbLeague).id}/gerer`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className={cardClass}>
      <div>
        <label htmlFor="new-league-name" className={labelClass}>Nom de la ligue</label>
        <input
          id="new-league-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          placeholder="ex : Ligue du jeudi"
          autoFocus
          className={inputClass}
        />
      </div>
      <VisibilityChoice value={visibility} onChange={setVisibility} />
      {error && <p className={errorClass}>{error}</p>}
      <button type="submit" disabled={!name.trim() || loading} className={`${primaryButtonClass} inline-flex items-center justify-center gap-2`}>
        <Plus className="w-4 h-4" /> {loading ? 'Création…' : 'Créer la ligue'}
      </button>
    </form>
  )
}
