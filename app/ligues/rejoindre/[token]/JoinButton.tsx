'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { errorClass, sendJson } from '@/components/formStyles'

export default function JoinButton({ token, children }: { token: string; children: React.ReactNode }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function join() {
    setLoading(true)
    setError('')
    try {
      const { error, data } = await sendJson('/api/leagues/join', 'POST', { token })
      if (error) return setError(error)
      router.push(`/ligues/${(data as { league_id: string }).league_id}/classement`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={join}
        disabled={loading}
        className="inline-flex items-center gap-2 bg-dc-gold text-dc-bg px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-dc-gold-light disabled:opacity-40"
      >
        {loading ? 'Inscription…' : children}
      </button>
      {error && <p className={errorClass}>{error}</p>}
    </div>
  )
}
