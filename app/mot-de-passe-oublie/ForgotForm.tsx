'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cardClass, errorClass, inputClass, labelClass, primaryButtonClass, sendJson, successClass } from '@/components/formStyles'

export const FORGOT_DONE =
  "Si un compte correspond et a une adresse mail, un lien vient d'être envoyé. Il est valable 1 heure. Pense à regarder tes spams. Pas d'adresse sur ton compte ? Demande un lien à l'admin."

export default function ForgotForm() {
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
        <label className={labelClass} htmlFor="identifier">Pseudo ou adresse mail</label>
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
      {done && <p className={successClass} data-testid="forgot-done">{FORGOT_DONE}</p>}
      <button type="submit" disabled={!identifier.trim() || loading} className={primaryButtonClass}>
        {loading ? 'Envoi…' : 'Envoyer le lien'}
      </button>
      <p className="text-center text-xs">
        <Link href="/connexion" className="text-dc-muted hover:text-dc-gold underline">Retour à la connexion</Link>
      </p>
    </form>
  )
}
