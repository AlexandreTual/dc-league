'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson, successClass } from '@/components/formStyles'
import { useT } from '@/components/i18n/I18nProvider'

export default function ForgotForm() {
  const m = useT().account.forgot
  const [identifier, setIdentifier] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await sendJson('/api/auth/forgot', 'POST', { identifier })
    setLoading(false)
    if (error) return setError(error)
    setDone(true)
  }

  return (
    <form onSubmit={submit} className={cardClass}>
      <div>
        <label className={labelClass} htmlFor="identifier">{m.identifier}</label>
        <input
          id="identifier"
          className={inputClass}
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value)
            setDone(false)
          }}
          autoComplete="username"
          autoFocus
        />
      </div>
      {error && <p className={errorClass}>{error}</p>}
      {done && <p className={successClass} data-testid="forgot-done">{m.done}</p>}
      <button type="submit" disabled={!identifier.trim() || loading} className={primaryButtonClass}>
        {loading ? m.sending : m.send}
      </button>
      <p className="text-center text-xs">
        <Link href="/connexion" className="text-dc-muted hover:text-dc-gold underline">{m.back}</Link>
      </p>
    </form>
  )
}
